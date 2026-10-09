#!/usr/bin/env bash
# Push the Apple signing + notarization credentials to this repo's GitHub
# Actions secrets, taken from the SAME identity and notary profile that
# agentic-loop's release uses (apps/presenter-windows/scripts/build-app.sh).
#
# Why this exists: release.yaml failed on v3.16.2 and v3.16.3 with
# "MAC verification failed during PKCS12 import" — the APPLE_CERTIFICATE_P12
# secret and APPLE_CERTIFICATE_PASSWORD did not match (or the p12 was built
# with OpenSSL 3 defaults, which macOS `security import` rejects). This script
# exports exactly one identity through the Security framework (Apple's own p12
# flavour, no other key in the keychain is touched), proves it imports exactly
# the way the workflow does, and only then uploads it.
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
need gh; need openssl; need security; need xcrun; need swiftc

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

# Export only that identity. `security export` would touch every private key
# in the keychain (a prompt for each, Jeremy's included); the Swift helper asks
# the keychain for this one identity, so the only prompt is for your key.
P12_PW="$(openssl rand -hex 24)"
HELPER="$WORK/export-identity"
swiftc -o "$HELPER" "$(dirname "$0")/lib/export-identity.swift"
echo "==> Exporting (keychain will prompt once, for the Jonathan Soeder key only)"
"$HELPER" "$IDENTITY_SHA" "$WORK/devid.p12" "$P12_PW"

# Hard guard: only Jonathan's Developer ID for team TXYJ5S79U2 may be pushed.
SUBJECT="$(openssl pkcs12 -in "$WORK/devid.p12" -passin "pass:$P12_PW" -nokeys -clcerts -legacy 2>/dev/null | openssl x509 -noout -subject)"
case "$SUBJECT" in
  *"Developer ID Application: Jonathan Soeder"*"$TEAM_ID"*) echo "    selected: $SUBJECT" ;;
  *) echo "Refusing: exported certificate is not Jonathan Soeder / $TEAM_ID:"; echo "    $SUBJECT"; exit 1 ;;
esac

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
