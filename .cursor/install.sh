#!/usr/bin/env bash
# Idempotent development-environment bootstrap for LunaDesk.
#
# LunaDesk is a macOS SwiftUI/AppKit app, so `swift build`/`swift run`/`swift test`
# only succeed on macOS with Xcode. On the Linux Cloud Agent VM this script installs
# the open-source Swift toolchain so package resolution, editing, and SourceKit-LSP
# work; the macOS GUI itself cannot be compiled or launched on Linux.
set -euo pipefail

SWIFT_VERSION="6.2.4"

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

# On macOS the Xcode toolchain already ships Swift + SwiftUI; nothing to install.
if [ "$(uname -s)" = "Darwin" ]; then
  log "macOS detected; using the system Swift toolchain."
  swift package resolve
  exit 0
fi

# --- Linux: install the open-source Swift toolchain -------------------------
UBUNTU_CODENAME="$(. /etc/os-release && echo "${VERSION_ID:-}")"
if [ "${UBUNTU_CODENAME}" != "24.04" ]; then
  log "WARNING: this script targets Ubuntu 24.04; detected '${UBUNTU_CODENAME}'. Continuing anyway."
fi

log "Installing Swift runtime dependencies via apt."
export DEBIAN_FRONTEND=noninteractive
sudo_cmd apt-get update -qq
sudo_cmd apt-get install -y -qq --no-install-recommends \
  binutils \
  ca-certificates \
  curl \
  git \
  gnupg2 \
  libc6-dev \
  libcurl4-openssl-dev \
  libedit2 \
  libgcc-13-dev \
  libncurses-dev \
  libpython3-dev \
  libsqlite3-0 \
  libstdc++-13-dev \
  libxml2-dev \
  libz3-dev \
  pkg-config \
  tzdata \
  unzip \
  zlib1g-dev

SWIFT_ROOT="/opt/swift"
SWIFT_BIN="${SWIFT_ROOT}/usr/bin"

install_swift_toolchain() {
  local url tmp
  url="https://download.swift.org/swift-${SWIFT_VERSION}-release/ubuntu2404/swift-${SWIFT_VERSION}-RELEASE/swift-${SWIFT_VERSION}-RELEASE-ubuntu24.04.tar.gz"
  tmp="$(mktemp -d)"
  log "Downloading Swift ${SWIFT_VERSION} toolchain."
  curl -fSL --retry 4 --retry-delay 4 -o "${tmp}/swift.tar.gz" "${url}"
  sudo_cmd rm -rf "${SWIFT_ROOT}"
  sudo_cmd mkdir -p "${SWIFT_ROOT}"
  log "Extracting toolchain to ${SWIFT_ROOT}."
  sudo_cmd tar xzf "${tmp}/swift.tar.gz" -C "${SWIFT_ROOT}" --strip-components=1
  rm -rf "${tmp}"
}

if [ -x "${SWIFT_BIN}/swift" ] && "${SWIFT_BIN}/swift" --version 2>/dev/null | grep -q "swift-${SWIFT_VERSION}"; then
  log "Swift ${SWIFT_VERSION} already installed at ${SWIFT_ROOT}; skipping download."
else
  install_swift_toolchain
fi

log "Exposing Swift on PATH (symlinks + /etc/profile.d)."
for tool in swift swiftc sourcekit-lsp swift-build swift-run swift-test swift-package; do
  if [ -x "${SWIFT_BIN}/${tool}" ]; then
    sudo_cmd ln -sf "${SWIFT_BIN}/${tool}" "/usr/local/bin/${tool}"
  fi
done
sudo_cmd tee /etc/profile.d/swift.sh >/dev/null <<EOF
export PATH="${SWIFT_BIN}:\$PATH"
EOF

export PATH="${SWIFT_BIN}:${PATH}"

log "Swift version:"
swift --version

log "Resolving Swift package dependencies."
swift package resolve

log "Done. NOTE: 'swift build'/'swift run LunaDesk'/'swift test' require macOS + Xcode"
log "because LunaDesk depends on SwiftUI and AppKit, which are unavailable on Linux."
