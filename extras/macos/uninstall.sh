#!/usr/bin/env bash
set -uo pipefail

LABEL="com.jdvivar.bizneo-clock.watcher"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

launchctl bootout "gui/$UID/$LABEL" 2>/dev/null || true
rm -f "$PLIST"

echo "✅ Uninstalled: $LABEL"
echo "   (your snooze/state files in ~/.config/bizneo-clock/reminders were left intact)"
