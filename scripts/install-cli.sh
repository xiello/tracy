#!/bin/bash
# Install Tracy CLI for quick access from terminal

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_SCRIPT="$SCRIPT_DIR/tracy-cli.sh"
INSTALL_PATH="/usr/local/bin/tracy"

echo "🔧 Installing Tracy CLI..."

# Make CLI executable
chmod +x "$CLI_SCRIPT"

# Create symlink (requires sudo for /usr/local/bin)
if [ -L "$INSTALL_PATH" ] || [ -f "$INSTALL_PATH" ]; then
    echo "Removing existing tracy command..."
    sudo rm "$INSTALL_PATH"
fi

sudo ln -s "$CLI_SCRIPT" "$INSTALL_PATH"

if [ $? -eq 0 ]; then
    echo "✅ Tracy CLI installed!"
    echo ""
    echo "Usage:"
    echo "  tracy -30 gas"
    echo "  tracy +500 salary"
    echo "  tracy -15 lunch at cafe"
    echo ""
    echo "Make sure the Tracy backend is running:"
    echo "  cd backend && npm run dev"
else
    echo "❌ Installation failed. Try running with sudo."
    exit 1
fi
