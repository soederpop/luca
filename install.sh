#!/bin/bash
# Luca installer — https://luca-js.soederpop.com
# curl -fsSL https://luca-js.soederpop.com/install.sh | bash
set -euo pipefail

REPO="soederpop/luca"
INSTALL_DIR="${LUCA_INSTALL_DIR:-$HOME/.luca/bin}"

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
mkdir -p "$INSTALL_DIR"
mv "$TMP" "${INSTALL_DIR}/luca"

# macOS quarantine
if [ "$OS" = "darwin" ]; then
  xattr -d com.apple.quarantine "${INSTALL_DIR}/luca" 2>/dev/null || true
fi

printf "\n"
ok "Installed luca to ${INSTALL_DIR}/luca"

printf "${dim}"
"${INSTALL_DIR}/luca" --version 2>/dev/null || true
printf "${reset}"

# PATH setup — append to the shell rc file unless already on PATH
add_to_path() {
  rc_file="$1"
  line="$2"
  reload="$3"

  if [ -f "$rc_file" ] && grep -qF "$line" "$rc_file"; then
    info "PATH already configured in ${rc_file}"
    return
  fi

  mkdir -p "$(dirname "$rc_file")"
  {
    printf "\n# Added by the Luca installer\n"
    printf "%s\n" "$line"
  } >> "$rc_file"

  ok "Added ${INSTALL_DIR} to your PATH in ${rc_file}"
  printf "\n"
  printf "  Restart your shell, or run: ${bold}%s${reset}\n" "$reload"
}

case ":$PATH:" in
  *":${INSTALL_DIR}:"*)
    ;;
  *)
    printf "\n"
    SHELL_NAME="$(basename "${SHELL:-}")"
    case "$SHELL_NAME" in
      zsh)
        add_to_path "$HOME/.zshrc" "export PATH=\"${INSTALL_DIR}:\$PATH\"" "source ~/.zshrc"
        ;;
      bash)
        if [ "$OS" = "darwin" ]; then
          add_to_path "$HOME/.bash_profile" "export PATH=\"${INSTALL_DIR}:\$PATH\"" "source ~/.bash_profile"
        else
          add_to_path "$HOME/.bashrc" "export PATH=\"${INSTALL_DIR}:\$PATH\"" "source ~/.bashrc"
        fi
        ;;
      fish)
        add_to_path "${XDG_CONFIG_HOME:-$HOME/.config}/fish/config.fish" "fish_add_path ${INSTALL_DIR}" "exec fish"
        ;;
      *)
        info "Add ${INSTALL_DIR} to your PATH:"
        printf "\n"
        printf "    ${bold}export PATH=\"${INSTALL_DIR}:\$PATH\"${reset}\n"
        printf "    ${dim}(add this to your shell's startup file)${reset}\n"
        ;;
    esac
    ;;
esac

printf "\n"
printf "  Run ${bold}luca${reset} to get started.\n"
printf "\n"
