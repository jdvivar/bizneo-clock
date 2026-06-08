#!/usr/bin/env bash
set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$DIR/config.sh"
source "$DIR/dialogs.sh"

mkdir -p "$STATE_DIR"
BIN="${BIZNEO_CLOCK_BIN:-bizneo-clock}"

if [ -f "$STATE_DIR/test-request" ]; then
  rm -f "$STATE_DIR/test-request"
  notify "bizneo-clock" "Test notification — reminders are working ✅"
  dlg_test
  exit 0
fi

if [ -f "$STATE_DIR/demo-request" ]; then
  rm -f "$STATE_DIR/demo-request"
  out="$("$BIN" status 2>&1)"
  notify "bizneo-clock" "Ran 'bizneo-clock status' from the agent ✅"
  dlg_show "The agent just ran 'bizneo-clock status':

$out

(demo only — no clock action taken)"
  exit 0
fi

dow=$(date +%u)
case " $ACTIVE_DAYS " in
  *" $dow "*) ;;
  *) exit 0 ;;
esac

now=$((10#$(date +%H%M)))
today=$(date +%Y%m%d)
nowepoch=$(date +%s)

find "$STATE_DIR" -type f -name 'clockin-skip-*' ! -name "clockin-skip-$today" -delete 2>/dev/null || true
find "$STATE_DIR" -type f -name 'login-notice-*' ! -name "login-notice-$today" -delete 2>/dev/null || true

json="$("$BIN" status --json 2>/dev/null)" || json=""
if [ -z "$json" ]; then
  marker="$STATE_DIR/login-notice-$today"
  if [ ! -f "$marker" ]; then
    notify "bizneo-clock" "Not logged in — run: bizneo-clock login"
    touch "$marker"
  fi
  exit 0
fi

status=$(printf '%s' "$json" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).status)}catch(e){console.log("")}})' 2>/dev/null)

snooze() { echo $((nowepoch + ${1:-$SNOOZE_DEFAULT} * 60)) > "$STATE_DIR/$2"; }
snoozed_until() {
  local f="$STATE_DIR/$1"
  [ -f "$f" ] && [ "$(cat "$f" 2>/dev/null || echo 0)" -gt "$nowepoch" ]
}

if [ "$now" -ge "$AUTO_CLOCKOUT" ]; then
  if [ "$status" = "working" ] || [ "$status" = "paused" ]; then
    if "$BIN" out >/dev/null 2>&1; then
      notify "bizneo-clock" "Auto clocked out at $(date +%H:%M). 👋"
    fi
  fi
  exit 0
fi

if [ "$now" -ge "$CLOCKOUT_REMIND" ]; then
  if [ "$status" = "working" ] || [ "$status" = "paused" ]; then
    if snoozed_until clockout-snooze; then exit 0; fi
    opts=( "Clock out now" )
    for m in $SNOOZE_PRESETS; do opts+=( "Snooze ${m} min" ); done
    opts+=( "Custom…" )
    choice="$(dlg_clockout "${opts[@]}")"
    case "$choice" in
      "Clock out now") "$BIN" out >/dev/null 2>&1 && notify "bizneo-clock" "Clocked out. Have a good evening! 👋" ;;
      "Custom…")
        m="$(dlg_custom_minutes)"
        if [[ "$m" =~ ^[0-9]+$ ]] && [ "$m" -gt 0 ]; then snooze "$m" clockout-snooze; else snooze "" clockout-snooze; fi
        ;;
      "") snooze "" clockout-snooze ;;
      *)
        mins="$(printf '%s' "$choice" | grep -oE '[0-9]+' | head -1)"
        if [[ "$mins" =~ ^[0-9]+$ ]]; then snooze "$mins" clockout-snooze; else snooze "" clockout-snooze; fi
        ;;
    esac
  fi
  exit 0
fi

if [ "$now" -ge "$MORNING_START" ] && [ "$now" -lt "$MORNING_END" ]; then
  if [ "$status" = "out" ]; then
    if [ -f "$STATE_DIR/clockin-skip-$today" ]; then exit 0; fi
    if snoozed_until clockin-snooze; then exit 0; fi
    choice="$(dlg_clockin "$SNOOZE_DEFAULT")"
    case "$choice" in
      "Clock in") "$BIN" in >/dev/null 2>&1 && notify "bizneo-clock" "Clocked in. ☕ Have a good one!" ;;
      "Skip today") touch "$STATE_DIR/clockin-skip-$today" ;;
      *) snooze "" clockin-snooze ;;
    esac
  fi
  exit 0
fi

exit 0
