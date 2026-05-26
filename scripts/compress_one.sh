#!/bin/bash
# Compress one GLB. Args: <input> <output>
set -e
export PATH="$HOME/.npm-global/bin:$PATH"
IN="$1"; OUT="$2"
TMP=$(mktemp -d)
trap "rm -rf $TMP" EXIT
gltf-transform dedup "$IN"          "$TMP/p1.glb" >/dev/null 2>&1
gltf-transform prune "$TMP/p1.glb"  "$TMP/p2.glb" >/dev/null 2>&1 || cp "$TMP/p1.glb" "$TMP/p2.glb"
gltf-transform weld  "$TMP/p2.glb"  "$TMP/p3.glb" >/dev/null 2>&1
gltf-transform webp  "$TMP/p3.glb"  "$TMP/p4.glb" --quality 85 >/dev/null 2>&1 || cp "$TMP/p3.glb" "$TMP/p4.glb"
gltf-transform draco "$TMP/p4.glb"  "$OUT" \
    --method edgebreaker \
    --quantize-position 14 --quantize-normal 10 --quantize-texcoord 12 \
    --quantize-color 8 --quantize-generic 12 >/dev/null 2>&1
echo "DONE: $(basename "$IN") $(du -h "$IN" | cut -f1) -> $(du -h "$OUT" | cut -f1)"
