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

# ── Persistent SSH multiplexed connection ─────────────
SSH_SOCK="/tmp/hydra-deploy-$$"
echo -e "${CYAN}==> Opening SSH tunnel...${NC}"
ssh -fNM -S "$SSH_SOCK" -o ControlPersist=120 "$PI_HOST"

cleanup() {
  ssh -S "$SSH_SOCK" -O exit "$PI_HOST" 2>/dev/null || true
  [ -n "$STAGING" ] && rm -rf "$STAGING"
}
trap cleanup EXIT

pissh()   { ssh -S "$SSH_SOCK" "$PI_HOST" "$@"; }
pirsync() { rsync -av -e "ssh -S $SSH_SOCK" "$@"; }

t=0
step_start() { t=$SECONDS; echo -e "\n${CYAN}==> $1${NC}"; }
step_done()  { echo -e "${DIM}    ✓ $(( SECONDS - t ))s${NC}"; }

# ── Build ─────────────────────────────────────────────
step_start "Building server"
yarn workspace @hydra/server run build
step_done

step_start "Building web"
yarn workspace @hydra/web run build
step_done

# ── Remote dirs ───────────────────────────────────────
step_start "Ensuring remote directories"
pissh "mkdir -p $PI_DIR/apps/server/dist $PI_DIR/apps/server/data $PI_DIR/apps/server/data/matter $PI_DIR/apps/web/dist"
step_done

# ── Sync dist ─────────────────────────────────────────
step_start "Syncing server dist"
pirsync --delete apps/server/dist/ "$PI_HOST:$PI_DIR/apps/server/dist/"
step_done

step_start "Syncing web dist"
pirsync --delete apps/web/dist/ "$PI_HOST:$PI_DIR/apps/web/dist/"
step_done

# ── Production deps (skip if package.json unchanged) ──
DEPS_HASH=$(md5 -q apps/server/package.json 2>/dev/null || md5sum apps/server/package.json | cut -d' ' -f1)
DEPS_HASH_FILE="/tmp/hydra-deps-hash"
PREV_HASH=$(cat "$DEPS_HASH_FILE" 2>/dev/null || echo "")

step_start "Syncing config files"
pirsync apps/server/package.json "$PI_HOST:$PI_DIR/apps/server/package.json"
pirsync ecosystem.config.cjs "$PI_HOST:$PI_DIR/"
step_done

if [ "$DEPS_HASH" != "$PREV_HASH" ] || [ "${1:-}" = "--deps" ]; then
  step_start "Installing production deps locally"
  STAGING=$(mktemp -d)
  cp apps/server/package.json "$STAGING/"
  (cd "$STAGING" && yarn install --production --ignore-engines --no-lockfile)
  step_done

  step_start "Packing node_modules"
  tar czf "$STAGING/node_modules.tar.gz" -C "$STAGING" --exclude='pigpio/build' node_modules
  step_done

  step_start "Transferring node_modules to Pi"
  scp -o "ControlPath=$SSH_SOCK" "$STAGING/node_modules.tar.gz" "$PI_HOST:/tmp/hydra-node_modules.tar.gz"
  step_done

  step_start "Extracting + rebuilding on Pi"
  ssh -S "$SSH_SOCK" -o ServerAliveInterval=10 -o ServerAliveCountMax=60 "$PI_HOST" \
    "cd $PI_DIR/apps/server && rm -rf node_modules && tar xzf /tmp/hydra-node_modules.tar.gz && rm /tmp/hydra-node_modules.tar.gz && npm rebuild pigpio > /tmp/hydra-rebuild.log 2>&1 || true; cat /tmp/hydra-rebuild.log"
  step_done

  echo "$DEPS_HASH" > "$DEPS_HASH_FILE"
else
  echo -e "\n${DIM}==> Deps unchanged, skipping node_modules sync${NC}"
fi

# ── Restart ───────────────────────────────────────────
step_start "Restarting PM2"
pissh "cd $PI_DIR && sudo pm2 delete hydra 2>/dev/null || true; sudo pm2 start ecosystem.config.cjs || true"
step_done

echo -e "\n${GREEN}==> Deploy complete! ($(( SECONDS - DEPLOY_START ))s total)${NC}"
