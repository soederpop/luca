#!/bin/bash
# Luca installer — https://luca-js.soederpop.com
# curl -fsSL https://luca-js.soederpop.com/install.sh | bash
set -euo pipefail

REPO="soederpop/luca"
INSTALL_DIR="${LUCA_INSTALL_DIR:-/usr/local/bin}"

# Colors
reset="\033[0m"
bold="\033[1m"
cyan="\033[36m"
green="\033[32m"
red="\033[31m"
dim="\033[2m"

info()  { printf "${cyan}>${reset} %s\n" "$*"; }
ok()    { printf "${green}>${reset} %s\n" "$*"; }
err()   { printf "${red}error${reset}: %s\n" "$*" >&2; exit 1; }

# Detect platform
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

case "$OS" in
  linux)  ;;
  darwin) ;;
  *)      err "Unsupported OS: $OS" ;;
esac

case "$ARCH" in
  x86_64)  ARCH="x64" ;;
  aarch64) ARCH="arm64" ;;
  arm64)   ARCH="arm64" ;;
  *)       err "Unsupported architecture: $ARCH" ;;
esac

BINARY="luca-${OS}-${ARCH}"
URL="https://github.com/${REPO}/releases/latest/download/${BINARY}"

printf "\n"
printf "${bold}  Luca${reset} ${dim}— Lightweight Universal Conversational Architecture${reset}\n"
printf "\n"

info "Detected platform: ${OS}-${ARCH}"
info "Downloading from GitHub releases..."

# Download
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

if ! curl -fsSL --progress-bar -o "$TMP" "$URL"; then
  err "Download failed. Check https://github.com/${REPO}/releases for available binaries."
fi

chmod +x "$TMP"

# Install
if [ -w "$INSTALL_DIR" ]; then
  mv "$TMP" "${INSTALL_DIR}/luca"
else
  info "Writing to ${INSTALL_DIR} requires sudo"
  sudo mv "$TMP" "${INSTALL_DIR}/luca"
  sudo chmod +x "${INSTALL_DIR}/luca"
fi

# macOS quarantine
if [ "$OS" = "darwin" ]; then
  xattr -d com.apple.quarantine "${INSTALL_DIR}/luca" 2>/dev/null || true
fi

printf "\n"
ok "Installed luca to ${INSTALL_DIR}/luca"

# Verify
if command -v luca &>/dev/null; then
  printf "${dim}"
  luca --version 2>/dev/null || true
  printf "${reset}"
fi

printf "\n"
printf "  Run ${bold}luca${reset} to get started.\n"
printf "\n"
