#!/bin/bash
# Compress all watch GLBs with Draco + WebP for the configurator site.
# Strategy:
#   - dedup + prune + weld: lossless cleanup
#   - draco mesh compression: heavy size win, no visual loss
#   - webp texture compression: smaller textures, supported in all modern browsers
#   - NO simplify (geometry decimation would degrade luxury detail)
#   - NO instance/flatten (we need named nodes intact for the configurator)
#
# Usage: bash compress.sh
set -euo pipefail
export PATH="$HOME/.npm-global/bin:$PATH"

# Override for local Windows/macOS: export WATCH_PARTS_ROOT="/path/to/Watch parts"
SRC="${WATCH_PARTS_ROOT:-/sessions/wonderful-eloquent-planck/mnt/Watch parts}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DST="${CONFIGURATOR_MODELS_DST:-$(cd "$SCRIPT_DIR/.." && pwd)/public/models}"

# Per-file pipeline that preserves geometry + named nodes + animations
optimize() {
    local in="$1" out="$2" label="$3"
    echo "[$(date +%H:%M:%S)] $label"
    # Pipeline: dedup → prune → weld → texture-compress webp → draco
    gltf-transform dedup        "$in"  "/tmp/p1.glb"  >/dev/null 2>&1
    gltf-transform prune        "/tmp/p1.glb" "/tmp/p2.glb" >/dev/null 2>&1 || cp "/tmp/p1.glb" "/tmp/p2.glb"
    gltf-transform weld         "/tmp/p2.glb" "/tmp/p3.glb" >/dev/null 2>&1
    gltf-transform webp         "/tmp/p3.glb" "/tmp/p4.glb" --quality 85 >/dev/null 2>&1 || cp "/tmp/p3.glb" "/tmp/p4.glb"
    gltf-transform draco        "/tmp/p4.glb" "$out" \
        --method edgebreaker \
        --quantize-position 14 \
        --quantize-normal 10 \
        --quantize-texcoord 12 \
        --quantize-color 8 \
        --quantize-generic 12 >/dev/null 2>&1
    local in_kb=$(du -k "$in" | cut -f1)
    local out_kb=$(du -k "$out" | cut -f1)
    local pct=$(awk "BEGIN { printf \"%.1f\", (1 - $out_kb / $in_kb) * 100 }")
    printf "    %s → %s  (%.1f MB → %.1f MB, %s%% saved)\n" \
        "$(basename "$in")" "$(basename "$out")" \
        $(awk "BEGIN { print $in_kb/1024 }") $(awk "BEGIN { print $out_kb/1024 }") "$pct"
}

# Dragon variants — small (35MB each) but 4 of them
for v in v1_imperial_rose_gold v2_sapphire_sky v3_white_gold v4_crimson_dragon; do
    optimize "$SRC/dragon/variants/dragon_${v}.glb" "$DST/dragon/dragon_${v}.glb" "DRAGON ${v}"
done

# Case (bezel + outer) — 71MB each
for v in rose_gold white_gold yellow_gold; do
    optimize "$SRC/case/variants/case_${v}.glb" "$DST/case/case_${v}.glb" "CASE ${v}"
done

# Case body — 38MB each
for v in rose_gold white_gold yellow_gold; do
    optimize "$SRC/case_body/case_body_${v}.glb" "$DST/case_body/case_body_${v}.glb" "CASE_BODY ${v}"
done

# Movement — 118MB each (the big ones)
for v in rose_gold white_gold yellow_gold; do
    optimize "$SRC/movement/variants/movement_${v}.glb" "$DST/movement/movement_${v}.glb" "MOVEMENT ${v}"
done

# Static parts
optimize "$SRC/dial/dial.glb"               "$DST/parts/dial.glb"   "DIAL"
for v in rose_gold white_gold yellow_gold; do
    optimize "$SRC/globe/variants/globe_${v}.glb" "$DST/parts/globe_${v}.glb" "GLOBE ${v}"
done
optimize "$SRC/hands/clock_hand_loose.glb"  "$DST/parts/hand.glb"   "HAND"
optimize "$SRC/strap/strap.glb"             "$DST/parts/strap.glb"  "STRAP (top+bottom)"

# Full watch — the hero asset with both NLA animations.
# 266MB → target ~25-40MB. Keep animations, no simplify, no flatten.
optimize "$SRC/full_watch/watch_full_default.glb" "$DST/full_watch/watch_full_default.glb" "FULL WATCH (HERO)"

echo
echo "=== Final size summary ==="
find "$DST" -name '*.glb' -printf "%-65p  %10s bytes\n" | sort
echo "TOTAL:"
du -sh "$DST"
