#!/usr/bin/env bash
set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$DIR/config.sh"
LABEL="com.jdvivar.bizneo-clock.watcher"

mkdir -p "$STATE_DIR"
touch "$STATE_DIR/test-request"

if launchctl kickstart -k "gui/$UID/$LABEL" 2>/dev/null; then
  echo "✅ Triggered a test via the launchd agent."
  echo "   A test notification + dialog should appear shortly."
  echo "   Approve any macOS permission prompt (Automation / Notifications) — that grant"
  echo "   then applies to the real reminders. Nothing is clocked in or out."
else
  echo "ℹ️  Agent not loaded — running the test directly (run install.sh to enable reminders)."
  rm -f "$STATE_DIR/test-request"
  source "$DIR/dialogs.sh"
  notify "bizneo-clock" "Test notification — reminders are working ✅"
  dlg_test
fi
