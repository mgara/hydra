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

  PIGPIO_CACHE="/home/pi/.cache/hydra-pigpio"
  PIGPIO_BUILD="apps/server/node_modules/pigpio/build"
  NODE_ABI="node-v$(node -e 'console.log(process.versions.modules)')"

  if [ "$COMBINED_HASH" != "$PREV_HASH" ] || [ "${1:-}" = "--deps" ]; then
    step_start "Installing dependencies (changed)"
    yarn install --ignore-engines
    step_done

    # Restore cached pigpio build, or rebuild and cache it
    if [ -f "$PIGPIO_CACHE/$NODE_ABI/pigpio.node" ]; then
      step_start "Restoring cached pigpio native build ($NODE_ABI)"
      mkdir -p "$PIGPIO_BUILD/Release"
      cp "$PIGPIO_CACHE/$NODE_ABI/pigpio.node" "$PIGPIO_BUILD/Release/"
      step_done
    else
      step_start "Rebuilding pigpio native module (first time for $NODE_ABI)"
      cd apps/server && npm rebuild pigpio --jobs=1 2>&1 || true
      cd "$HYDRA_DIR"
      if [ -f "$PIGPIO_BUILD/Release/pigpio.node" ]; then
        mkdir -p "$PIGPIO_CACHE/$NODE_ABI"
        cp "$PIGPIO_BUILD/Release/pigpio.node" "$PIGPIO_CACHE/$NODE_ABI/"
        echo -e "${DIM}    cached for future deploys${NC}"
      fi
      step_done
    fi

    echo "$COMBINED_HASH" > "$DEPS_HASH_FILE"
  else
    echo -e "\n${DIM}    deps unchanged, skipping install${NC}"
    # Ensure pigpio build exists even if deps didn't change
    if [ ! -f "$PIGPIO_BUILD/Release/pigpio.node" ] && [ -f "$PIGPIO_CACHE/$NODE_ABI/pigpio.node" ]; then
      step_start "Restoring cached pigpio native build"
      mkdir -p "$PIGPIO_BUILD/Release"
      cp "$PIGPIO_CACHE/$NODE_ABI/pigpio.node" "$PIGPIO_BUILD/Release/"
      step_done
    fi
  fi

  # ── Restart PM2 ──────────────────────────────────
  step_start "Restarting PM2"
  sudo pm2 delete hydra 2>/dev/null || true
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
