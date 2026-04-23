#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
BUILD_BIN_DIR="$ROOT_DIR/build/bin"
DOWNLOADS_DIR="$ROOT_DIR/sanctum-journal-website/downloads"
STAGE_DIR="/tmp/sanctum-journal-package"
APP_NAME="Sanctum Journal"
APP_DIR="$STAGE_DIR/$APP_NAME.app"
EXECUTABLE_NAME="sanctum-journal"
ZIP_PATH="$DOWNLOADS_DIR/Sanctum-Journal-macOS.zip"

if [[ -n "${PYTHON_BIN:-}" ]]; then
  ICON_PYTHON="$PYTHON_BIN"
elif [[ -x "$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3" ]]; then
  ICON_PYTHON="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3"
else
  ICON_PYTHON="python3"
fi

mkdir -p "$BUILD_BIN_DIR" "$DOWNLOADS_DIR"
rm -rf "$STAGE_DIR"
mkdir -p "$APP_DIR/Contents/MacOS" "$APP_DIR/Contents/Resources"

"$ICON_PYTHON" "$ROOT_DIR/scripts/sync_app_icon.py"

(
  cd "$FRONTEND_DIR"
  npm run build
)

env GOCACHE=/tmp/go-build \
  CGO_LDFLAGS="-framework UniformTypeIdentifiers" \
  /opt/homebrew/bin/go build \
  -buildvcs=false \
  -tags desktop,wv2runtime.download,production \
  -ldflags "-w -s" \
  -o "$BUILD_BIN_DIR/$EXECUTABLE_NAME" \
  "$ROOT_DIR"

cp "$BUILD_BIN_DIR/$EXECUTABLE_NAME" "$APP_DIR/Contents/MacOS/$EXECUTABLE_NAME"
chmod +x "$APP_DIR/Contents/MacOS/$EXECUTABLE_NAME"

cat > "$APP_DIR/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>CFBundleDisplayName</key>
    <string>Sanctum Journal</string>
    <key>CFBundleExecutable</key>
    <string>sanctum-journal</string>
    <key>CFBundleGetInfoString</key>
    <string>Built using Wails (https://wails.io)</string>
    <key>CFBundleIconFile</key>
    <string>iconfile</string>
    <key>CFBundleIdentifier</key>
    <string>com.wails.sanctum-journal</string>
    <key>CFBundleName</key>
    <string>Sanctum Journal</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.13.0</string>
    <key>NSAppTransportSecurity</key>
    <dict>
      <key>NSAllowsLocalNetworking</key>
      <true/>
    </dict>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSHumanReadableCopyright</key>
    <string>Copyright.........</string>
  </dict>
</plist>
PLIST

cp "$ROOT_DIR/build/darwin/iconfile.icns" "$APP_DIR/Contents/Resources/iconfile.icns"

codesign --force --deep --sign - "$APP_DIR"
ditto -c -k --sequesterRsrc --keepParent "$APP_DIR" "$ZIP_PATH"

echo "Packaged $ZIP_PATH"
