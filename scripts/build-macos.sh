#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BIN_NAME="bun-ipfs"
INSTALL_DIR="/usr/local/bin"
STATE_DIR="$HOME/.local/store/bun-ipfs"

echo "Building $BIN_NAME for macOS ARM64..."
cd "$PROJECT_DIR"
bun build src/index.ts --compile --target=bun-darwin-arm64 --outfile "$BIN_NAME-macos"

echo "Installing to $INSTALL_DIR/$BIN_NAME..."
mv "$BIN_NAME-macos" "$INSTALL_DIR/$BIN_NAME"

echo "Creating state directory..."
mkdir -p "$STATE_DIR/reports"

# Copy imgcat if available (iTerm2 inline images)
if [ -f "$HOME/.iterm2/imgcat" ]; then
  cp "$HOME/.iterm2/imgcat" "$STATE_DIR/imgcat"
  echo "Copied imgcat to $STATE_DIR/imgcat"
fi

# Add alias if not present
SHELL_ALIASES="$HOME/.shellaliases"
if [ -f "$SHELL_ALIASES" ]; then
  if ! grep -q "alias $BIN_NAME=" "$SHELL_ALIASES" 2>/dev/null; then
    echo "alias $BIN_NAME='$INSTALL_DIR/$BIN_NAME'" >> "$SHELL_ALIASES"
    echo "Added alias to $SHELL_ALIASES"
  fi
fi

echo ""
echo "Verifying installation..."
"$INSTALL_DIR/$BIN_NAME" --version

echo ""
echo "Done. Run: $BIN_NAME --help"
