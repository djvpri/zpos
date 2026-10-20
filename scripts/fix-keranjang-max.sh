#!/usr/bin/env bash
# fix-keranjang-max.sh — naikkan KERANJANG_MAX + sync error message.
# Bug: KERANJANG_MAX=200 tapi error message bilang "maks 50" — inconsistent.
# Pattern 1: const KERANJANG_MAX = 200
# Pattern 2: entries.length > 200 inline (bon/[id]/route.ts)
#
# Usage:
#   ./scripts/fix-keranjang-max.sh --dry-run [NEW_MAX=500]
#   ./scripts/fix-keranjang-max.sh --apply 500
set -euo pipefail

NEW_MAX="500"
MODE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) MODE="dry"; shift ;;
    --apply) MODE="apply"; shift ;;
    [0-9]*) NEW_MAX="$1"; shift ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

[[ -z "$MODE" ]] && { echo "Need --dry-run or --apply" >&2; exit 2; }

PATCH_COUNT=0
for f in "src/app/api/bon/route.ts" "src/app/api/bon/[id]/route.ts"; do
  [[ ! -f "$f" ]] && { echo "SKIP (not found): $f" >&2; continue; }
  echo "=== $f ==="

  # Pattern 1: const KERANJANG_MAX = <N>  +  message "maks <N>"
  OLD_MAX=$(grep -oP 'KERANJANG_MAX\s*=\s*\K\d+' "$f" | head -1 || echo "")
  if [[ -n "$OLD_MAX" ]]; then
    echo "  KERANJANG_MAX: $OLD_MAX → $NEW_MAX"
    if [[ "$MODE" == "dry" ]]; then
      echo "  (dry-run — no change)"
    else
      sed -i -E "s/(KERANJANG_MAX\s*=\s*)${OLD_MAX}/\1${NEW_MAX}/g" "$f"
      # also sync error message if it referenced old max
      sed -i -E "s/maks ${OLD_MAX}/maks ${NEW_MAX}/g" "$f"
      PATCH_COUNT=$((PATCH_COUNT + 1))
    fi
  else
    # Pattern 2: entries.length > <N> inline
    OLD_INLINE=$(grep -oP 'entries\.length\s*>\s*\K\d+' "$f" | head -1 || echo "")
    if [[ -n "$OLD_INLINE" ]]; then
      echo "  inline max: $OLD_INLINE → $NEW_MAX"
      if [[ "$MODE" == "dry" ]]; then
        echo "  (dry-run — no change)"
      else
        sed -i -E "s/(entries\.length\s*>\s*)${OLD_INLINE}/\1${NEW_MAX}/g; s/maks ${OLD_INLINE}/maks ${NEW_MAX}/g" "$f"
        PATCH_COUNT=$((PATCH_COUNT + 1))
      fi
    fi
  fi
done

if [[ "$MODE" == "apply" ]]; then
  echo ""
  echo "Done — $PATCH_COUNT file patched."
  echo "Verify: npm run build && npm test"
  echo "Then: git add -A && git commit -m 'fix(bon): KERANJANG_MAX jadi $NEW_MAX + sync error message'"
fi