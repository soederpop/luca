#!/usr/bin/env bash
# Push the Apple signing + notarization credentials to this repo's GitHub
# Actions secrets, taken from the SAME identity and notary profile that
# agentic-loop's release uses (apps/presenter-windows/scripts/build-app.sh).
#
# Why this exists: release.yaml failed on v3.16.2 and v3.16.3 with
# "MAC verification failed during PKCS12 import" — the APPLE_CERTIFICATE_P12
# secret and APPLE_CERTIFICATE_PASSWORD did not match (or the p12 was built
# with OpenSSL 3 defaults, which macOS `security import` rejects). This script
# exports the identity, repackages it in the legacy PKCS#12 format macOS
# accepts, proves it imports exactly the way the workflow does, and only then
# uploads it.
#
# Run it interactively on the machine that holds the keys. Expect keychain
# access prompts. Nothing secret is written outside a temp dir that is
# removed on exit.
#
#   bash scripts/sync-apple-signing-secrets.sh            # export + verify + push
#   bash scripts/sync-apple-signing-secrets.sh --dry-run  # export + verify only
set -euo pipefail

IDENTITY_SHA="${IDENTITY_SHA:-0668DE8F197145C75A5D0D0EFF689E72A5585CBD}" # Developer ID Application: Jonathan Soeder (TXYJ5S79U2)
TEAM_ID="${TEAM_ID:-TXYJ5S79U2}"
NOTARY_PROFILE="${NOTARY_PROFILE:-agentic-loop-notary}"
REPO="${REPO:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

need() { command -v "$1" >/dev/null || { echo "missing: $1"; exit 1; }; }
need gh; need openssl; need security; need xcrun

WORK="$(mktemp -d)"
SCRATCH_KEYCHAIN="$WORK/verify.keychain-db"
cleanup() {
  security delete-keychain "$SCRATCH_KEYCHAIN" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

echo "==> Identity $IDENTITY_SHA"
security find-identity -v -p codesigning | grep -q "$IDENTITY_SHA" \
  || { echo "Identity not in this keychain. Run: security find-identity -v -p codesigning"; exit 1; }

# `security export` has no per-item filter, so export every identity, then
# cut out the one we want with openssl. The temp password never leaves $WORK.
TMP_PW="$(openssl rand -hex 16)"
echo "==> Exporting identities (keychain will prompt once per private key)"
security export -t identities -f pkcs12 -P "$TMP_PW" -o "$WORK/all.p12"
openssl pkcs12 -in "$WORK/all.p12" -passin "pass:$TMP_PW" -nodes -legacy -out "$WORK/all.pem" 2>/dev/null \
  || openssl pkcs12 -in "$WORK/all.p12" -passin "pass:$TMP_PW" -nodes -out "$WORK/all.pem"

# Find the cert with our SHA-1 and the private key that shares its localKeyID.
python3 - "$WORK/all.pem" "$IDENTITY_SHA" "$WORK/cert.pem" "$WORK/key.pem" <<'PY'
import re, subprocess, sys
pem, want, cert_out, key_out = sys.argv[1:]
text = open(pem).read()
# Each bag: whatever openssl printed since the previous block (Bag Attributes,
# localKeyID, subject=, ...) followed by one PEM block.
bags = []
pos = 0
for m in re.finditer(r'-----BEGIN ([A-Z ]+)-----.*?-----END \1-----\n', text, re.S):
    bags.append((text[pos:m.start()], m.group(0), m.group(1)))
    pos = m.end()
def key_id(attrs):
    m = re.search(r'localKeyID:\s*([0-9A-Fa-f ]+)', attrs)
    return m.group(1).replace(' ', '').upper() if m else None
cert = key = None
for attrs, block, kind in bags:
    if kind == 'CERTIFICATE':
        fp = subprocess.run(['openssl', 'x509', '-noout', '-fingerprint', '-sha1'], input=block, capture_output=True, text=True).stdout
        fp = fp.split('=')[-1].replace(':', '').strip().upper()
        if fp == want.upper():
            cert = (key_id(attrs), block)
for attrs, block, kind in bags:
    if kind != 'CERTIFICATE' and cert and key_id(attrs) == cert[0]:
        key = block
if not cert: sys.exit('certificate %s not found in export' % want)
if not key: sys.exit('private key for %s not found in export' % want)
open(cert_out, 'w').write(cert[1]); open(key_out, 'w').write(key)
PY

# Include the Apple intermediate so codesign can build the chain on a bare runner.
security find-certificate -c "Developer ID Certification Authority" -p -a > "$WORK/chain.pem" 2>/dev/null || true

# -legacy: macOS `security import` only understands the RC2/3DES + SHA1 MAC
# flavour. OpenSSL 3 defaults to AES/SHA256, which is exactly the
# "MAC verification failed" error CI hit.
P12_PW="$(openssl rand -hex 24)"
openssl pkcs12 -export -legacy \
  -inkey "$WORK/key.pem" -in "$WORK/cert.pem" -certfile "$WORK/chain.pem" \
  -name "Developer ID Application" -passout "pass:$P12_PW" -out "$WORK/devid.p12"

echo "==> Verifying the p12 imports the way release.yaml does"
security create-keychain -p "" "$SCRATCH_KEYCHAIN"
security import "$WORK/devid.p12" -k "$SCRATCH_KEYCHAIN" -P "$P12_PW" -T /usr/bin/codesign >/dev/null
security unlock-keychain -p "" "$SCRATCH_KEYCHAIN"
security set-key-partition-list -S apple-tool:,apple: -s -k "" "$SCRATCH_KEYCHAIN" >/dev/null
security find-identity -v -p codesigning "$SCRATCH_KEYCHAIN" | grep -q "$IDENTITY_SHA" \
  || { echo "Imported p12 does not yield a valid codesigning identity"; exit 1; }
echo "    ok — identity imports and is valid for codesigning"

echo "==> Notarization credentials from keychain profile '$NOTARY_PROFILE'"
# notarytool store-credentials saves a JSON blob; the item's account is the profile name.
NOTARY_JSON="$(security find-generic-password -a "$NOTARY_PROFILE" -w 2>/dev/null || true)"
APPLE_ID="$(printf '%s' "$NOTARY_JSON" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("apple-id") or d.get("appleId") or d.get("apple_id") or "")' 2>/dev/null || true)"
APP_PW="$(printf '%s' "$NOTARY_JSON" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("password") or d.get("app-specific-password") or "")' 2>/dev/null || true)"
if [ -z "$APPLE_ID" ] || [ -z "$APP_PW" ]; then
  echo "    could not read the profile automatically; enter the values notarytool uses"
  read -rp "    Apple ID: " APPLE_ID
  read -rsp "    App-specific password: " APP_PW; echo
fi
echo "    checking with notarytool history (team $TEAM_ID)"
xcrun notarytool history --apple-id "$APPLE_ID" --password "$APP_PW" --team-id "$TEAM_ID" >/dev/null \
  || { echo "notarytool rejected these credentials for team $TEAM_ID"; exit 1; }
echo "    ok"

if [ "$DRY_RUN" = 1 ]; then
  echo "==> --dry-run: not pushing secrets to $REPO"
  exit 0
fi

echo "==> Pushing secrets to $REPO"
base64 < "$WORK/devid.p12" | tr -d '\n' | gh secret set APPLE_CERTIFICATE_P12 --repo "$REPO"
printf '%s' "$P12_PW"   | gh secret set APPLE_CERTIFICATE_PASSWORD --repo "$REPO"
printf '%s' "$TEAM_ID"  | gh secret set APPLE_TEAM_ID --repo "$REPO"
printf '%s' "$APPLE_ID" | gh secret set APPLE_ID --repo "$REPO"
printf '%s' "$APP_PW"   | gh secret set APPLE_APP_PASSWORD --repo "$REPO"
gh secret list --repo "$REPO"
echo "==> Done. Re-run the failed release with: gh run rerun <run-id> --failed"
