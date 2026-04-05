#!/usr/bin/env bash
set -euo pipefail

HYDRA_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$HYDRA_DIR"

CYAN='\033[0;36m'
GREEN='\033[0;32m'
DIM='\033[2m'
RED='\033[0;31m'
NC='\033[0m'

DEPLOY_START=$SECONDS
t=0
step_start() { t=$SECONDS; echo -e "\n${CYAN}==> $1${NC}"; }
step_done()  { echo -e "${DIM}    ✓ $(( SECONDS - t ))s${NC}"; }

# ── Detect environment ──────────────────────────────
ON_PI=false
if [ "$(uname -m)" = "aarch64" ] || [ "$(uname -m)" = "armv7l" ]; then
  ON_PI=true
fi

if [ "$ON_PI" = true ]; then
  # ── Running on Pi: stop, pull, install deps, rebuild pigpio, restart ──

  step_start "Stopping and removing PM2 process"
  sudo pm2 delete hydra 2>/dev/null || true
  step_done

  step_start "Pulling latest from GitHub"
  git pull --ff-only
  step_done

  # ── Install deps if changed ───────────────────────
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

  # ── pigpio native module ──────────────────────────
  NODE_ABI="node-v$(node -e 'console.log(process.versions.modules)')"
  NODE_VERSION="$(node -v)"
  PIGPIO_CACHE="/home/pi/.cache/hydra-pigpio"
  PIGPIO_ABI_FILE="$PIGPIO_CACHE/abi"
  PIGPIO_BINARY="$PIGPIO_CACHE/$NODE_ABI/pigpio.node"
  PIGPIO_SOURCE="node_modules/pigpio"
  PIGPIO_TARGETS=(
    "node_modules/pigpio/build/Release"
    "apps/server/node_modules/pigpio/build/Release"
  )

  INSTALLED_ABI=$(cat "$PIGPIO_ABI_FILE" 2>/dev/null || echo "")

  # Build pigpio natively if no cached binary or ABI changed
  if [ ! -f "$PIGPIO_BINARY" ] || [ "$INSTALLED_ABI" != "$NODE_ABI" ]; then
    echo -e "\n${CYAN}    pigpio cached for: ${INSTALLED_ABI:-none}${NC}"
    echo -e "${CYAN}    node running:      $NODE_ABI ($NODE_VERSION)${NC}"

    step_start "Building pigpio.node natively (node-gyp, --jobs=1)"
    cd "$PIGPIO_SOURCE" && npx --yes node-gyp rebuild --jobs=1 2>&1
    cd "$HYDRA_DIR"

    if [ -f "$PIGPIO_SOURCE/build/Release/pigpio.node" ]; then
      mkdir -p "$PIGPIO_CACHE/$NODE_ABI"
      cp "$PIGPIO_SOURCE/build/Release/pigpio.node" "$PIGPIO_BINARY"
      echo "$NODE_ABI" > "$PIGPIO_ABI_FILE"
      echo -e "${DIM}    cached to $PIGPIO_BINARY${NC}"
    else
      echo -e "${RED}    ⚠ pigpio build failed — GPIO will not work${NC}"
    fi
    step_done
  else
    echo -e "\n${DIM}    pigpio.node cached and up to date ($NODE_ABI)${NC}"
  fi

  # Copy pigpio.node to all locations where bindings looks for it
  if [ -f "$PIGPIO_BINARY" ]; then
    step_start "Restoring pigpio.node ($NODE_ABI)"
    for target in "${PIGPIO_TARGETS[@]}"; do
      mkdir -p "$target"
      cp "$PIGPIO_BINARY" "$target/"
    done
    step_done
  fi

  # ── Start PM2 ──────────────────────────────────────
  step_start "Starting PM2"
  sudo pm2 start ecosystem.config.cjs
  step_done

else
  # ── Running on Mac: build, commit dist, push ───────
  step_start "Building server"
  yarn workspace @hydra/server run build
  step_done

  step_start "Building web"
  yarn workspace @hydra/web run build
  step_done

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
fi

echo -e "\n${GREEN}==> Deploy complete! ($(( SECONDS - DEPLOY_START ))s total)${NC}"
