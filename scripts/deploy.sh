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

  # ── Native modules (pigpio + i2c-bus) ───────────────
  NODE_ABI="node-v$(node -e 'console.log(process.versions.modules)')"
  NODE_VERSION="$(node -v)"

  # ── pigpio native module ──────────────────────────
  PIGPIO_CACHE="/home/pi/.cache/hydra-pigpio"
  PIGPIO_ABI_FILE="$PIGPIO_CACHE/abi"
  PIGPIO_BINARY="$PIGPIO_CACHE/$NODE_ABI/pigpio.node"
  PIGPIO_SOURCE="node_modules/pigpio"
  PIGPIO_TARGETS=(
    "node_modules/pigpio/build/Release"
  )

  INSTALLED_ABI=$(cat "$PIGPIO_ABI_FILE" 2>/dev/null || echo "")

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

  if [ -f "$PIGPIO_BINARY" ]; then
    step_start "Restoring pigpio.node ($NODE_ABI)"
    for target in "${PIGPIO_TARGETS[@]}"; do
      mkdir -p "$target"
      cp "$PIGPIO_BINARY" "$target/"
    done
    step_done
  fi

  # ── i2c-bus native module ─────────────────────────
  I2C_CACHE="/home/pi/.cache/hydra-i2c-bus"
  I2C_ABI_FILE="$I2C_CACHE/abi"
  I2C_BINARY="$I2C_CACHE/$NODE_ABI/i2c.node"
  I2C_SOURCE="node_modules/i2c-bus"
  I2C_TARGETS=(
    "node_modules/i2c-bus/build/Release"
  )

  I2C_INSTALLED_ABI=$(cat "$I2C_ABI_FILE" 2>/dev/null || echo "")

  if [ -d "$I2C_SOURCE" ]; then
    if [ ! -f "$I2C_BINARY" ] || [ "$I2C_INSTALLED_ABI" != "$NODE_ABI" ]; then
      echo -e "\n${CYAN}    i2c-bus cached for: ${I2C_INSTALLED_ABI:-none}${NC}"
      echo -e "${CYAN}    node running:       $NODE_ABI ($NODE_VERSION)${NC}"

      step_start "Building i2c.node natively (node-gyp, --jobs=1)"
      cd "$I2C_SOURCE" && npx --yes node-gyp rebuild --jobs=1 2>&1
      cd "$HYDRA_DIR"

      if [ -f "$I2C_SOURCE/build/Release/i2c.node" ]; then
        mkdir -p "$I2C_CACHE/$NODE_ABI"
        cp "$I2C_SOURCE/build/Release/i2c.node" "$I2C_BINARY"
        echo "$NODE_ABI" > "$I2C_ABI_FILE"
        echo -e "${DIM}    cached to $I2C_BINARY${NC}"
      else
        echo -e "${RED}    ⚠ i2c-bus build failed — OLED will not work${NC}"
      fi
      step_done
    else
      echo -e "\n${DIM}    i2c.node cached and up to date ($NODE_ABI)${NC}"
    fi

    if [ -f "$I2C_BINARY" ]; then
      step_start "Restoring i2c.node ($NODE_ABI)"
      for target in "${I2C_TARGETS[@]}"; do
        mkdir -p "$target"
        cp "$I2C_BINARY" "$target/"
      done
      step_done
    fi
  else
    echo -e "\n${DIM}    i2c-bus not installed, skipping native build${NC}"
  fi

  # ── bleno native module ──────────────────────────
  BLENO_CACHE="/home/pi/.cache/hydra-bleno"
  BLENO_ABI_FILE="$BLENO_CACHE/abi"
  BLENO_BINARY="$BLENO_CACHE/$NODE_ABI/binding.node"
  BLENO_SOURCE="node_modules/@abandonware/bleno"
  BLENO_TARGETS=(
    "node_modules/@abandonware/bleno/build/Release"
  )

  BLENO_INSTALLED_ABI=$(cat "$BLENO_ABI_FILE" 2>/dev/null || echo "")

  if [ -d "$BLENO_SOURCE" ]; then
    if [ ! -f "$BLENO_BINARY" ] || [ "$BLENO_INSTALLED_ABI" != "$NODE_ABI" ]; then
      echo -e "\n${CYAN}    bleno cached for: ${BLENO_INSTALLED_ABI:-none}${NC}"
      echo -e "${CYAN}    node running:     $NODE_ABI ($NODE_VERSION)${NC}"

      step_start "Building bleno natively (node-gyp, --jobs=1)"
      cd "$BLENO_SOURCE" && npx --yes node-gyp rebuild --jobs=1 2>&1
      cd "$HYDRA_DIR"

      if [ -f "$BLENO_SOURCE/build/Release/binding.node" ]; then
        mkdir -p "$BLENO_CACHE/$NODE_ABI"
        cp "$BLENO_SOURCE/build/Release/binding.node" "$BLENO_BINARY"
        echo "$NODE_ABI" > "$BLENO_ABI_FILE"
        echo -e "${DIM}    cached to $BLENO_BINARY${NC}"
      else
        echo -e "${RED}    ⚠ bleno build failed — BLE will not work${NC}"
      fi
      step_done
    else
      echo -e "\n${DIM}    bleno binding.node cached and up to date ($NODE_ABI)${NC}"
    fi

    if [ -f "$BLENO_BINARY" ]; then
      step_start "Restoring bleno binding.node ($NODE_ABI)"
      for target in "${BLENO_TARGETS[@]}"; do
        mkdir -p "$target"
        cp "$BLENO_BINARY" "$target/"
      done
      step_done
    fi
  else
    echo -e "\n${DIM}    bleno not installed, skipping native build${NC}"
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
  git add -A apps/server/dist apps/web/dist
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
