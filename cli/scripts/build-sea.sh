#!/usr/bin/env bash
set -euo pipefail

# Build standalone executables using Node.js Single Executable Applications (SEA).
# Prerequisites:
#   - Node.js >= 20 with SEA support
#   - npm install -g postject
#   - Run `pnpm build && pnpm bundle` first to produce bundle/index.js

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_DIR="$(dirname "$SCRIPT_DIR")"
cd "$CLI_DIR"

echo "==> Generating SEA blob..."
node --experimental-sea-config scripts/sea-config.json

PLATFORM="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

# Normalize arch
case "$ARCH" in
  x86_64)  ARCH="x64" ;;
  aarch64) ARCH="arm64" ;;
  arm64)   ARCH="arm64" ;;
esac

OUTPUT_NAME="gh-admin-${PLATFORM}-${ARCH}"
OUTPUT_DIR="$CLI_DIR/dist-bin"
mkdir -p "$OUTPUT_DIR"

echo "==> Creating binary for ${PLATFORM}-${ARCH}..."

# Copy the Node.js binary
cp "$(command -v node)" "$OUTPUT_DIR/$OUTPUT_NAME"
chmod +x "$OUTPUT_DIR/$OUTPUT_NAME"

# Remove the code signature on macOS (required before injection)
if [[ "$PLATFORM" == "darwin" ]]; then
  codesign --remove-signature "$OUTPUT_DIR/$OUTPUT_NAME" 2>/dev/null || true
fi

# Inject the SEA blob
npx postject "$OUTPUT_DIR/$OUTPUT_NAME" NODE_SEA_BLOB sea-prep.blob \
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2

# Re-sign on macOS
if [[ "$PLATFORM" == "darwin" ]]; then
  codesign --sign - "$OUTPUT_DIR/$OUTPUT_NAME" 2>/dev/null || true
fi

# Clean up
rm -f sea-prep.blob

echo "==> Built: $OUTPUT_DIR/$OUTPUT_NAME"
ls -lh "$OUTPUT_DIR/$OUTPUT_NAME"
