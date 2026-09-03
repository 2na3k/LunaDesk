#!/usr/bin/env bash
# Idempotent development-environment bootstrap for LunaDesk.
#
# LunaDesk is a Next.js (App Router, TypeScript, Tailwind) web app that is also
# packaged as a macOS desktop app with Electron. This script installs Node.js
# (if needed) and the project's npm dependencies so `next dev`, `next build`,
# type-checking, tests, and the Electron shell all work on the Linux Cloud Agent VM.
#
# Note: producing the signed macOS `.dmg` (`npm run dist:mac`) requires a macOS
# runner; it cannot be generated on Linux.
set -euo pipefail

log() { printf '\n[install] %s\n' "$*"; }

sudo_cmd() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo "$@"
  else
    echo "[install] ERROR: need root privileges for: $*" >&2
    return 1
  fi
}

MIN_NODE_MAJOR=22

have_node() {
  command -v node >/dev/null 2>&1
}

node_major() {
  node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0
}

# --- Ensure a recent Node.js is available -----------------------------------
if have_node && [ "$(node_major)" -ge "${MIN_NODE_MAJOR}" ]; then
  log "Node $(node --version) already present."
else
  log "Installing Node.js ${MIN_NODE_MAJOR}.x via NodeSource."
  export DEBIAN_FRONTEND=noninteractive
  sudo_cmd apt-get update -qq
  sudo_cmd apt-get install -y -qq --no-install-recommends curl ca-certificates
  curl -fsSL "https://deb.nodesource.com/setup_${MIN_NODE_MAJOR}.x" | sudo_cmd -E bash -
  sudo_cmd apt-get install -y -qq nodejs
  log "Installed Node $(node --version)."
fi

# --- Install project dependencies -------------------------------------------
cd "$(dirname "$0")/.."

log "Installing npm dependencies."
if [ -f package-lock.json ]; then
  npm ci --no-audit --no-fund || npm install --no-audit --no-fund
else
  npm install --no-audit --no-fund
fi

log "Done. Common commands:"
log "  npm run dev        # Next.js dev server on :3000"
log "  npm run build      # production build (output: standalone)"
log "  npm run typecheck  # tsc --noEmit"
log "  npm test           # vitest"
log "  npm run electron:dev  # run the Electron desktop shell against next dev"
log "  npm run dist:mac   # build signed .dmg (requires macOS runner)"
