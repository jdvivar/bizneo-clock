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
active=0
case " $ACTIVE_DAYS " in
  *" $dow "*) active=1 ;;
esac

now=$((10#$(date +%H%M)))
today=$(date +%Y%m%d)
nowepoch=$(date +%s)

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*"; }

find "$STATE_DIR" -type f -name 'clockin-skip-*' ! -name "clockin-skip-$today" -delete 2>/dev/null || true
find "$STATE_DIR" -type f -name 'login-notice-*' ! -name "login-notice-$today" -delete 2>/dev/null || true

read_state() {
  local json
  json="$("$BIN" status --json 2>/dev/null)" || json=""
  if [ -z "$json" ]; then
    status=""
    elapsed=""
    return 1
  fi
  read -r status elapsed < <(printf '%s' "$json" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);console.log(j.status||"",j.elapsedSeconds??"")}catch(e){console.log("")}})' 2>/dev/null)
  [ -n "$status" ]
}

if ! read_state; then
  marker="$STATE_DIR/login-notice-$today"
  if [ ! -f "$marker" ]; then
    notify "bizneo-clock" "Not logged in — run: bizneo-clock login"
    touch "$marker"
  fi
  exit 0
fi

snooze() { echo $((nowepoch + ${1:-$SNOOZE_DEFAULT} * 60)) > "$STATE_DIR/$2"; }
snoozed_until() {
  local f="$STATE_DIR/$1"
  [ -f "$f" ] && [ "$(cat "$f" 2>/dev/null || echo 0)" -gt "$nowepoch" ]
}

at_time() { date -j "${@:3}" -f "%Y%m%d%H%M%S" "$1$(printf '%04d' "$2")00" +%s; }

session_deadline() {
  local start hm day
  if ! [[ "$elapsed" =~ ^[0-9]+$ ]]; then
    late=0
    start_dow=$dow
    start_clock="?"
    deadline=$(at_time "$today" "$AUTO_CLOCKOUT")
    return
  fi
  start=$((nowepoch - elapsed))
  hm=$((10#$(date -j -r "$start" +%H%M)))
  day=$(date -j -r "$start" +%Y%m%d)
  start_dow=$(date -j -r "$start" +%u)
  start_clock=$(date -j -r "$start" +%H:%M)
  if [ "$hm" -ge "$AUTO_CLOCKOUT" ]; then
    late=1
    deadline=$(at_time "$day" "$LATE_AUTO_CLOCKOUT" -v+1d)
  elif [ "$hm" -lt "$LATE_AUTO_CLOCKOUT" ]; then
    late=1
    deadline=$(at_time "$day" "$LATE_AUTO_CLOCKOUT")
  else
    late=0
    deadline=$(at_time "$day" "$AUTO_CLOCKOUT")
  fi
}

clock_out_now() {
  if [ "$status" = "paused" ]; then "$BIN" resume >/dev/null 2>&1 || true; fi
  "$BIN" out >/dev/null 2>&1 || true
  read_state && [ "$status" = "out" ]
}

auto_clockout() {
  local was="$status"
  if clock_out_now; then
    log "auto clock-out: was $was since $start_clock, now out"
    notify "bizneo-clock" "Auto clocked out at $(date +%H:%M). 👋"
    dlg_alert "You were still clocked in (since $start_clock), so bizneo-clock clocked you out automatically at $(date +%H:%M)."
  else
    log "auto clock-out FAILED: was $was since $start_clock, now ${status:-unknown}"
    notify "bizneo-clock" "Auto clock-out failed — check Bizneo."
    dlg_alert "bizneo-clock tried to clock you out automatically at $(date +%H:%M), but you still appear ${status:-in an unknown state}. Please check Bizneo."
  fi
}

if [ "$status" = "working" ] || [ "$status" = "paused" ]; then
  session_deadline
  if [ "$nowepoch" -ge "$deadline" ]; then
    case " $ACTIVE_DAYS " in
      *" $start_dow "*) auto_clockout ;;
    esac
    exit 0
  fi
  [ "$late" -eq 1 ] && exit 0
  [ "$active" -eq 1 ] || exit 0
  if [ "$now" -ge "$CLOCKOUT_REMIND" ]; then
    if snoozed_until clockout-snooze; then exit 0; fi
    opts=( "Clock out now" )
    for m in $SNOOZE_PRESETS; do opts+=( "Snooze ${m} min" ); done
    opts+=( "Custom…" )
    choice="$(dlg_clockout "${opts[@]}")"
    case "$choice" in
      "Clock out now")
        if clock_out_now; then
          log "clock-out from reminder"
          notify "bizneo-clock" "Clocked out. Have a good evening! 👋"
        else
          log "clock-out from reminder FAILED: now ${status:-unknown}"
          dlg_alert "Clock-out didn't go through — you still appear ${status:-in an unknown state}. Please check Bizneo."
        fi
        ;;
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

[ "$active" -eq 1 ] || exit 0

if [ "$now" -ge "$MORNING_START" ] && [ "$now" -lt "$MORNING_END" ]; then
  if [ "$status" = "out" ]; then
    if [ -f "$STATE_DIR/clockin-skip-$today" ]; then exit 0; fi
    if snoozed_until clockin-snooze; then exit 0; fi
    choice="$(dlg_clockin "$SNOOZE_DEFAULT")"
    case "$choice" in
      "Clock in")
        if "$BIN" in >/dev/null 2>&1; then
          log "clock-in from morning nudge"
          notify "bizneo-clock" "Clocked in. ☕ Have a good one!"
        fi
        ;;
      "Skip today") touch "$STATE_DIR/clockin-skip-$today" ;;
      *) snooze "" clockin-snooze ;;
    esac
  fi
  exit 0
fi

exit 0
