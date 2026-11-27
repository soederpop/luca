#!/usr/bin/env bash
# Builds dist/Luca Desktop.app from apps/desktop.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="Luca Desktop.app"
EXECUTABLE_NAME="LucaDesktop"
BUILD_CONFIG="release"
DIST_DIR="$ROOT_DIR/dist"
APP_DIR="$DIST_DIR/$APP_NAME"

# Developer ID signing identity (the same one luca's release uses). An
# explicitly empty DEV_ID= signs ad-hoc.
DEV_ID="${DEV_ID-0668DE8F197145C75A5D0D0EFF689E72A5585CBD}"  # Developer ID Application: Jonathan Soeder (TXYJ5S79U2)

REPO_ROOT="$(cd "$ROOT_DIR/../.." && pwd)"
VERSION="$(cd "$REPO_ROOT" && bun -e 'console.log((await Bun.file("package.json").json()).version ?? "0.0.0")' 2>/dev/null || echo "0.0.0")"
BUILD="$(git -C "$REPO_ROOT" rev-list --count HEAD 2>/dev/null || echo "0")"

cd "$ROOT_DIR"

# swift build can print "input file … was modified during the build" (an
# editor or another agent touched a source mid-build), exit 0, and leave the
# previous binary in place. Fail loudly instead of packaging a stale app.
BUILD_LOG="$(mktemp)"
swift build -c "$BUILD_CONFIG" --product "$EXECUTABLE_NAME" 2>&1 | tee "$BUILD_LOG"
if grep -q "^error:\|: error:" "$BUILD_LOG"; then
  echo "build-app: swift build reported errors (see above); not packaging" >&2
  rm -f "$BUILD_LOG"
  exit 1
fi
rm -f "$BUILD_LOG"
BINARY="$ROOT_DIR/.build/arm64-apple-macosx/$BUILD_CONFIG/$EXECUTABLE_NAME"
NEWER="$(find "$ROOT_DIR/Sources" -name '*.swift' -newer "$BINARY" | head -3)"
if [ -n "$NEWER" ]; then
  echo "build-app: sources changed after the binary was built; run again:" >&2
  echo "$NEWER" >&2
  exit 1
fi

rm -rf "$APP_DIR"
mkdir -p "$APP_DIR/Contents/MacOS" "$APP_DIR/Contents/Resources"

cp "$BINARY" "$APP_DIR/Contents/MacOS/$EXECUTABLE_NAME"
cp "$ROOT_DIR/packaging/Info.plist" "$APP_DIR/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $VERSION" -c "Set :CFBundleVersion $BUILD" "$APP_DIR/Contents/Info.plist"
echo "Version: $VERSION (build $BUILD)"

# Drawn by scripts/make-icon.swift and committed.
cp "$ROOT_DIR/packaging/AppIcon.icns" "$APP_DIR/Contents/Resources/AppIcon.icns"

# The source tile's editor page: a prebuilt, committed single file. Plain
# file in Contents/Resources, read through Bundle.main.
if [ ! -f "$ROOT_DIR/Resources/source-editor.html" ]; then
  echo "error: Resources/source-editor.html is missing" >&2
  exit 1
fi
cp "$ROOT_DIR/Resources/source-editor.html" "$APP_DIR/Contents/Resources/source-editor.html"

# highlight.js for code colors in the preview and rich views
# (Sources/Tiles/Shared/CodeHighlighter.swift). Same reason it is a plain file.
cp "$ROOT_DIR/Resources/highlight.min.js" "$ROOT_DIR/Resources/highlight.js-LICENSE.txt" "$APP_DIR/Contents/Resources/"

# Assistants the app installs into ~/.luca/assistants on launch
# (Sources/App/BundledAssistants.swift), so every Luca project has them.
# lucaArchitect and its other skills live in assistants/lucaArchitect here. The
# luca-framework skill is the one this checkout's `luca bootstrap
# --update-skill` writes, so it always matches the repo. The stamp is a hash
# of the files, so the app replaces an installed copy only when the content
# changed.
ASSISTANTS_DIR="$APP_DIR/Contents/Resources/assistants"
rm -rf "$ASSISTANTS_DIR"
mkdir -p "$ASSISTANTS_DIR"
cp -R "$ROOT_DIR/assistants/lucaArchitect" "$ASSISTANTS_DIR/lucaArchitect"
SKILL_TMP="$(mktemp -d)"
(cd "$SKILL_TMP" && bun "$REPO_ROOT/src/cli/cli.ts" bootstrap --update-skill >/dev/null)
cp -R "$SKILL_TMP/.claude/skills/luca-framework" "$ASSISTANTS_DIR/lucaArchitect/skills/luca-framework"
rm -rf "$SKILL_TMP"
for skill in "$ASSISTANTS_DIR"/lucaArchitect/skills/*; do
  if [ ! -f "$skill/SKILL.md" ]; then
    echo "error: $skill has no SKILL.md" >&2
    exit 1
  fi
done
find "$ASSISTANTS_DIR" -name .DS_Store -delete
(cd "$ASSISTANTS_DIR/lucaArchitect" && find . -type f ! -name .luca-desktop-build -print0 | sort -z | xargs -0 shasum | shasum | cut -d' ' -f1) > "$ASSISTANTS_DIR/lucaArchitect/.luca-desktop-build"
echo "Bundled assistant lucaArchitect ($(find "$ASSISTANTS_DIR/lucaArchitect" -type f | wc -l | tr -d ' ') files)"

# The portfolio project the projects tile chats with (lucaPortfolio and the
# portfolio feature). BundledPortfolio installs it file by file into
# ~/.luca/portfolio and never overwrites a file the user changed.
PORTFOLIO_DIR="$APP_DIR/Contents/Resources/portfolio"
rm -rf "$PORTFOLIO_DIR"
cp -R "$ROOT_DIR/portfolio" "$PORTFOLIO_DIR"
find "$PORTFOLIO_DIR" -name .DS_Store -delete
echo "Bundled portfolio project ($(find "$PORTFOLIO_DIR" -type f | wc -l | tr -d ' ') files)"

# A SwiftPM resource .bundle traps off-machine (Bundle.module looks for the
# builder's .build path). The default keymap is compiled in for this reason.
spm_bundles=$(find "$ROOT_DIR/.build/arm64-apple-macosx/$BUILD_CONFIG" -maxdepth 1 -name '*.bundle' 2>/dev/null || true)
if [ -n "$spm_bundles" ]; then
  echo "error: unpackaged SwiftPM resource bundle(s) detected:" >&2
  echo "$spm_bundles" >&2
  exit 1
fi

chmod +x "$APP_DIR/Contents/MacOS/$EXECUTABLE_NAME"

if [ -n "$DEV_ID" ]; then
  echo "Developer ID signing: $DEV_ID"
  codesign --force --timestamp --options=runtime \
    --entitlements "$ROOT_DIR/packaging/entitlements.plist" \
    --sign "$DEV_ID" "$APP_DIR" >/dev/null
  codesign --verify --deep --strict --verbose=2 "$APP_DIR"
else
  echo "Ad-hoc signing (set DEV_ID for Developer ID distribution)"
  codesign --force --deep --sign - "$APP_DIR" >/dev/null
fi

echo "Built app bundle: $APP_DIR"
