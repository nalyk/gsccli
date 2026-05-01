#!/usr/bin/env bash
# Build a single-executable application (SEA) from the gsccli bin.
# Requires Node 22+ and platform-native build tools (codesign on macOS, no extra deps on Linux).
#
# This script is documentation-grade: tested only on the host where you run it.
# For multi-platform release artifacts, run it inside a matrix build (GH Actions).

set -euo pipefail

if [[ ! -f dist/index.js ]]; then
  echo "==> Building TS first..."
  pnpm build
fi

echo "==> Generating SEA blob..."
node --experimental-sea-config sea-config.json

PLATFORM=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)
OUT="dist/gsccli-${PLATFORM}-${ARCH}"

echo "==> Copying node binary to ${OUT}..."
cp "$(command -v node)" "${OUT}"

case "${PLATFORM}" in
  darwin)
    echo "==> Removing macOS code signature so we can re-embed the blob..."
    codesign --remove-signature "${OUT}"
    ;;
esac

echo "==> Injecting SEA blob..."
pnpm dlx postject "${OUT}" NODE_SEA_BLOB dist/gsccli.blob \
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 \
  $( [[ "${PLATFORM}" == "darwin" ]] && echo --macho-segment-name NODE_SEA )

case "${PLATFORM}" in
  darwin)
    echo "==> Re-signing macOS binary..."
    codesign --sign - "${OUT}"
    ;;
esac

echo "==> Verifying..."
"${OUT}" --version
echo "==> Done: ${OUT}"
