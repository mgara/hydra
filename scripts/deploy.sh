#!/usr/bin/env bash
set -euo pipefail

PI_HOST="pi@192.168.0.69"
PI_DIR="~/hydra"

CYAN='\033[0;36m'
GREEN='\033[0;32m'
DIM='\033[2m'
NC='\033[0m'

DEPLOY_START=$SECONDS

# ── Persistent SSH multiplexed connection ─────────────
SSH_SOCK="/tmp/hydra-deploy-$$"
echo -e "${CYAN}==> Opening SSH tunnel...${NC}"
ssh -fNM -S "$SSH_SOCK" -o ControlPersist=120 "$PI_HOST"

cleanup() {
  ssh -S "$SSH_SOCK" -O exit "$PI_HOST" 2>/dev/null || true
}
trap cleanup EXIT

pissh() { ssh -S "$SSH_SOCK" "$PI_HOST" "$@"; }

t=0
step_start() { t=$SECONDS; echo -e "\n${CYAN}==> $1${NC}"; }
step_done()  { echo -e "${DIM}    ✓ $(( SECONDS - t ))s${NC}"; }

# ── Build locally ────────────────────────────────────
step_start "Building server"
yarn workspace @hydra/server run build
step_done

step_start "Building web"
yarn workspace @hydra/web run build
step_done

# ── Commit dist + push ──────────────────────────────
step_start "Committing build artifacts"
git add apps/server/dist apps/web/dist
if git diff --cached --quiet; then
  echo -e "${DIM}    no build changes${NC}"
else
  git commit -m "build: deploy $(date +%Y-%m-%d-%H%M)"
fi
step_done

step_start "Pushing to GitHub"
git push
step_done

# ── Pull on Pi ───────────────────────────────────────
step_start "Pulling on Pi"
pissh "cd $PI_DIR && git pull --ff-only"
step_done

# ── Install deps (skip if yarn.lock unchanged) ──────
step_start "Checking dependencies"
NEEDS_INSTALL=$(pissh "cd $PI_DIR && git diff HEAD~1 --name-only -- yarn.lock apps/server/package.json 2>/dev/null | head -1")
if [ -n "$NEEDS_INSTALL" ] || [ "${1:-}" = "--deps" ]; then
  step_start "Installing production deps on Pi"
  pissh "cd $PI_DIR/apps/server && yarn install --production --ignore-engines --no-lockfile"
  step_done

  step_start "Rebuilding native modules"
  pissh "cd $PI_DIR/apps/server && npm rebuild pigpio 2>&1 || true"
  step_done
else
  echo -e "${DIM}    deps unchanged, skipping${NC}"
fi

# ── Restart ──────────────────────────────────────────
step_start "Restarting PM2"
pissh "cd $PI_DIR && sudo pm2 delete hydra 2>/dev/null || true; sudo pm2 start ecosystem.config.cjs || true"
step_done

echo -e "\n${GREEN}==> Deploy complete! ($(( SECONDS - DEPLOY_START ))s total)${NC}"
