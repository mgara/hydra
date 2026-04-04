#!/usr/bin/env bash
set -euo pipefail

PI_HOST="pi@192.168.0.69"
PI_DIR="~/hydra"

CYAN='\033[0;36m'
GREEN='\033[0;32m'
DIM='\033[2m'
NC='\033[0m'

DEPLOY_START=$SECONDS
STAGING=""

cleanup() {
  [ -n "$STAGING" ] && rm -rf "$STAGING"
}
trap cleanup EXIT

pissh() { ssh -o ConnectTimeout=10 "$PI_HOST" "$@"; }

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

# ── Install deps (skip if package.json unchanged) ────
step_start "Checking dependencies"
DEPS_HASH=$(md5 -q apps/server/package.json 2>/dev/null || md5sum apps/server/package.json | cut -d' ' -f1)
DEPS_HASH_FILE="/tmp/hydra-deps-hash"
PREV_HASH=$(cat "$DEPS_HASH_FILE" 2>/dev/null || echo "")

if [ "$DEPS_HASH" != "$PREV_HASH" ] || [ "${1:-}" = "--deps" ]; then
  STAGING=$(mktemp -d)

  step_start "Installing production deps locally"
  cp apps/server/package.json "$STAGING/"
  (cd "$STAGING" && yarn install --production --ignore-engines --no-lockfile)
  step_done

  step_start "Packing node_modules"
  COPYFILE_DISABLE=1 tar czf "$STAGING/node_modules.tar.gz" -C "$STAGING" --exclude='pigpio/build' node_modules
  step_done

  step_start "Transferring node_modules to Pi"
  scp "$STAGING/node_modules.tar.gz" "$PI_HOST:/tmp/hydra-node_modules.tar.gz"
  step_done

  step_start "Extracting + rebuilding native modules on Pi"
  pissh "cd $PI_DIR/apps/server && rm -rf node_modules && tar xzf /tmp/hydra-node_modules.tar.gz && rm /tmp/hydra-node_modules.tar.gz && npm rebuild pigpio 2>&1 || true"
  step_done

  echo "$DEPS_HASH" > "$DEPS_HASH_FILE"
else
  echo -e "${DIM}    deps unchanged, skipping${NC}"
fi

# ── Restart ──────────────────────────────────────────
step_start "Restarting PM2"
pissh "cd $PI_DIR && sudo pm2 delete hydra 2>/dev/null || true; sudo pm2 start ecosystem.config.cjs || true"
step_done

echo -e "\n${GREEN}==> Deploy complete! ($(( SECONDS - DEPLOY_START ))s total)${NC}"
