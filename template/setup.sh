#!/bin/bash
# claudeclaw-starter setup script
set -e

STARTER_DIR="$(cd "$(dirname "$0")" && pwd)"
CLAUDE_CONFIG="$HOME/.claude"

echo "==> Setting up ClaudeClaw starter from: $STARTER_DIR"

# 1. Ensure ~/.claude exists
mkdir -p "$CLAUDE_CONFIG"

# 2. Copy settings.json (registers claudeclaw marketplace + enables plugin)
if [ -f "$CLAUDE_CONFIG/settings.json" ]; then
  echo "==> ~/.claude/settings.json already exists — skipping (merge manually if needed)."
  echo "    Reference: $STARTER_DIR/config/settings.json"
else
  echo "==> Installing settings.json..."
  cp "$STARTER_DIR/config/settings.json" "$CLAUDE_CONFIG/settings.json"
  echo "    Done."
fi

echo ""
echo "==> Done. Next steps:"
echo "    1. Edit CLAUDE.md — fill in the assistant's identity and your info."
echo "    2. Open Claude Code in this directory: claude $STARTER_DIR"
echo "    3. ClaudeClaw plugin loads automatically."
echo "    4. Install optional plugins via /install-skill inside Claude Code."
