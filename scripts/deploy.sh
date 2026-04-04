#!/usr/bin/env bash
set -euo pipefail

HYDRA_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$HYDRA_DIR"

CYAN='\033[0;36m'
GREEN='\033[0;32m'
DIM='\033[2m'
NC='\033[0m'

DEPLOY_START=$SECONDS
t=0
step_start() { t=$SECONDS; echo -e "\n${CYAN}==> $1${NC}"; }
step_done()  { echo -e "${DIM}    ✓ $(( SECONDS - t ))s${NC}"; }

# ── Pull latest ─────────────────────────────────────
step_start "Pulling latest from GitHub"
git pull --ff-only
step_done

# ── Install deps if changed ─────────────────────────
DEPS_HASH_FILE="/tmp/hydra-deps-hash"
ROOT_HASH=$(md5sum package.json yarn.lock 2>/dev/null | md5sum | cut -d' ' -f1)
SERVER_HASH=$(md5sum apps/server/package.json 2>/dev/null | cut -d' ' -f1)
WEB_HASH=$(md5sum apps/web/package.json 2>/dev/null | cut -d' ' -f1)
COMBINED_HASH="${ROOT_HASH}-${SERVER_HASH}-${WEB_HASH}"
PREV_HASH=$(cat "$DEPS_HASH_FILE" 2>/dev/null || echo "")

if [ "$COMBINED_HASH" != "$PREV_HASH" ] || [ "${1:-}" = "--deps" ]; then
  step_start "Installing dependencies (changed)"
  yarn install --ignore-engines
  step_done
  echo "$COMBINED_HASH" > "$DEPS_HASH_FILE"
else
  echo -e "\n${DIM}    deps unchanged, skipping install${NC}"
fi

# ── Build server ────────────────────────────────────
step_start "Building server"
yarn workspace @hydra/server run build
step_done

# ── Build web ───────────────────────────────────────
step_start "Building web"
yarn workspace @hydra/web run build
step_done

# ── Restart PM2 ─────────────────────────────────────
step_start "Restarting PM2"
sudo pm2 delete hydra 2>/dev/null || true
sudo pm2 start ecosystem.config.cjs
step_done

echo -e "\n${GREEN}==> Deploy complete! ($(( SECONDS - DEPLOY_START ))s total)${NC}"
