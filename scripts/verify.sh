#!/usr/bin/env bash
# verify.sh — pre-commit check: build + lint + test + repro.
# Agent jalankan 1x sebelum push. Output ringkas, exit 0 = ready push.
#
# Usage: ./scripts/verify.sh [--no-build] [--no-lint] [--no-test] [--no-repro]
set -euo pipefail

RUN_BUILD=1
RUN_LINT=1
RUN_TEST=1
RUN_REPRO=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-build) RUN_BUILD=0; shift ;;
    --no-lint) RUN_LINT=0; shift ;;
    --no-test) RUN_TEST=0; shift ;;
    --no-repro) RUN_REPRO=0; shift ;;
    *) echo "Unknown: $1" >&2; exit 2 ;;
  esac
done

PASS=0
FAIL=0
STEP=0

run_step() {
  local name="$1"
  local cmd="$2"
  STEP=$((STEP + 1))
  echo "[$STEP/$TOTAL] $name"
  if eval "$cmd" > /tmp/verify-out.log 2>&1; then
    echo "  ✓ pass"
    PASS=$((PASS + 1))
    # show last 3 lines utk konfirmasi
    tail -3 /tmp/verify-out.log | head -3 | sed 's/^/    /'
  else
    echo "  ✗ FAIL"
    FAIL=$((FAIL + 1))
    tail -20 /tmp/verify-out.log | sed 's/^/    /'
  fi
}

TOTAL=$((RUN_BUILD + RUN_LINT + RUN_TEST + RUN_REPRO))

[[ "$RUN_BUILD" -eq 1 ]] && run_step "npm run build" "npm run build"
[[ "$RUN_LINT" -eq 1 ]] && run_step "npm run lint" "npm run lint 2>&1 | tail -20"
[[ "$RUN_TEST" -eq 1 ]] && run_step "npm test" "npm test 2>&1 | tail -10"
[[ "$RUN_REPRO" -eq 1 ]] && run_step "repro tests" "for f in tests/repro/*.mjs; do echo \"  -- \$f\"; node --experimental-strip-types \"\$f\" 2>&1 | tail -3; done"

echo ""
echo "=== Summary: $PASS pass, $FAIL fail ==="
[[ "$FAIL" -eq 0 ]] && exit 0 || exit 1