#!/usr/bin/env bash
set -euo pipefail

# Auto-improvement routine for local development:
# install deps, normalize formatting, then run core quality gates.
SKIP_TESTS=0
if [[ "${1:-}" == "--skip-tests" ]]; then
  SKIP_TESTS=1
fi

if [[ ! -d node_modules ]]; then
  echo "[auto-improve] Installing dependencies (node_modules missing)..."
  pnpm install
fi

echo "[auto-improve] Applying formatter..."
pnpm format:fix

echo "[auto-improve] Running static checks..."
pnpm check

if [[ "$SKIP_TESTS" -eq 0 ]]; then
  echo "[auto-improve] Running fast test suite..."
  OPENCLAW_TEST_PROFILE=low OPENCLAW_TEST_SERIAL_GATEWAY=1 pnpm test:fast
else
  echo "[auto-improve] Skipping tests (--skip-tests)."
fi

echo "[auto-improve] Done."
