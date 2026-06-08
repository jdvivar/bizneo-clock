#!/usr/bin/env bash
set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$DIR/config.sh"

mkdir -p "$STATE_DIR"
touch "$STATE_DIR/demo-request"

if launchctl kickstart -k "gui/$UID/$LABEL" 2>/dev/null; then
  echo "✅ Asked the agent to run 'bizneo-clock status'."
  echo "   A dialog with the live status output should appear. No clock action is taken."
else
  echo "ℹ️  Agent not loaded — running directly (run install.sh to enable reminders)."
  rm -f "$STATE_DIR/demo-request"
  source "$DIR/dialogs.sh"
  out="$(bizneo-clock status 2>&1)"
  dlg_show "bizneo-clock status:

$out

(demo only)"
fi
