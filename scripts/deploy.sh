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

# ── Detect environment ──────────────────────────────
ON_PI=false
if [ "$(uname -m)" = "aarch64" ] || [ "$(uname -m)" = "armv7l" ]; then
  ON_PI=true
fi

if [ "$ON_PI" = true ]; then
  # ── Running on Pi: stop, pull, install deps, restart ──
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

  NODE_ABI="node-v$(node -e 'console.log(process.versions.modules)')"
  PIGPIO_CACHED="$HYDRA_DIR/scripts/pigpio-cache/$NODE_ABI/pigpio.node"
  PIGPIO_TARGET="node_modules/pigpio/build/Release"

  if [ "$COMBINED_HASH" != "$PREV_HASH" ] || [ "${1:-}" = "--deps" ]; then
    step_start "Installing dependencies (changed)"
    yarn install --ignore-engines
    step_done
    echo "$COMBINED_HASH" > "$DEPS_HASH_FILE"
  else
    echo -e "\n${DIM}    deps unchanged, skipping install${NC}"
  fi

  # Always restore pre-built pigpio binary (cross-compiled on Mac)
  PIGPIO_VERSION_FILE="/home/pi/.cache/hydra-pigpio-abi"
  INSTALLED_ABI=$(cat "$PIGPIO_VERSION_FILE" 2>/dev/null || echo "")
  NODE_VERSION="$(node -v)"

  if [ "$INSTALLED_ABI" != "$NODE_ABI" ]; then
    echo -e "\n${CYAN}    pigpio compiled for: ${INSTALLED_ABI:-none}${NC}"
    echo -e "${CYAN}    node running:        $NODE_ABI ($NODE_VERSION)${NC}"
  fi

  if [ -f "$PIGPIO_CACHED" ]; then
    step_start "Restoring pre-built pigpio.node ($NODE_ABI)"
    mkdir -p "$PIGPIO_TARGET"
    cp "$PIGPIO_CACHED" "$PIGPIO_TARGET/"
    echo "$NODE_ABI" > "$PIGPIO_VERSION_FILE"
    step_done
  else
    echo -e "\n${DIM}    ⚠ No cached pigpio.node for $NODE_ABI — run cross-compile on Mac:${NC}"
    echo -e "${DIM}    docker run --rm --platform linux/arm64 \\\\${NC}"
    echo -e "${DIM}      -v \"\\\$PWD/node_modules/pigpio\":/app -w /app \\\\${NC}"
    echo -e "${DIM}      node:22 sh -c \"npm install -g node-gyp && node-gyp rebuild --jobs=1\"${NC}"
    echo -e "${DIM}    Then copy to: scripts/pigpio-cache/$NODE_ABI/pigpio.node${NC}"
  fi

  # ── Restart PM2 ──────────────────────────────────
  step_start "Starting PM2"
  sudo pm2 start ecosystem.config.cjs
  step_done

else
  # ── Running on Mac: build, commit dist, push ─────
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
