#!/usr/bin/env bash
# GLB → USDZ for iOS Quick Look (requires Docker).
set -euo pipefail

SRC="${1:-public/models/full_watch/watch_full_ar.glb}"
OUT="${2:-public/models/full_watch/watch_full_ar.usdz}"

if [ ! -f "$SRC" ]; then
  echo "Source not found: $SRC" >&2
  exit 1
fi

docker run --rm -v "$(pwd)":/work -w /work \
  leon/usd-from-gltf:latest "$SRC" "$OUT"

echo "Wrote $OUT ($(stat -c%s "$OUT" 2>/dev/null || stat -f%z "$OUT") bytes)"
