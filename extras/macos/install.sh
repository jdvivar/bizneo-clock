#!/usr/bin/env bash
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

BIN="$(command -v bizneo-clock || true)"
if [ -z "$BIN" ]; then
  echo "❌ bizneo-clock not found on PATH. Install it first:  npm i -g bizneo-clock" >&2
  exit 1
fi
BIN_DIR="$(cd "$(dirname "$BIN")" && pwd)"

mkdir -p "$STATE_DIR" "$(dirname "$PLIST")"
LOG="$STATE_DIR/watcher.log"
PATHVAL="$BIN_DIR:/usr/bin:/bin:/usr/sbin:/sbin"

sed -e "s|__LABEL__|$LABEL|g" \
    -e "s|__WATCH__|$SCRIPT_DIR/watch.sh|g" \
    -e "s|__PATH__|$PATHVAL|g" \
    -e "s|__LOG__|$LOG|g" \
    -e "s|__TICK__|$TICK_SECONDS|g" \
    "$SCRIPT_DIR/watcher.plist.template" > "$PLIST"

launchctl bootout "gui/$UID/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$UID" "$PLIST"
launchctl enable "gui/$UID/$LABEL"
launchctl kickstart -k "gui/$UID/$LABEL" 2>/dev/null || true

echo "✅ Installed and loaded: $LABEL"
echo "   runs:   $SCRIPT_DIR/watch.sh (every ${TICK_SECONDS}s, at login, and after wake)"
echo "   log:    $LOG"
echo "   config: $SCRIPT_DIR/config.sh"
echo
echo "If you move this repo, re-run install.sh so the agent points at the new path."
