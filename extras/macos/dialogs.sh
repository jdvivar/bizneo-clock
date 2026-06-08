#!/usr/bin/env bash

notify() {
  /usr/bin/osascript -e "display notification \"$2\" with title \"$1\"" >/dev/null 2>&1 || true
}

dlg_clockin() {
  /usr/bin/osascript <<'EOF' 2>/dev/null
try
  tell application "System Events"
    activate
    set b to button returned of (display dialog "Ready to start work?" with title "bizneo-clock" buttons {"Skip today", "Snooze 15m", "Clock in"} default button "Clock in" with icon note giving up after 120)
  end tell
  return b
on error
  return ""
end try
EOF
}

dlg_clockout() {
  /usr/bin/osascript <<'EOF' 2>/dev/null
set opts to {"Clock out now", "Snooze 15 min", "Snooze 30 min", "Snooze 45 min", "Snooze 1 hour", "Custom…"}
tell application "System Events" to activate
set c to choose from list opts with title "bizneo-clock" with prompt "Time to wrap up — clock out?" default items {"Clock out now"}
if c is false then
  return ""
else
  return item 1 of c
end if
EOF
}

dlg_custom_minutes() {
  /usr/bin/osascript <<'EOF' 2>/dev/null
try
  tell application "System Events" to activate
  set r to text returned of (display dialog "Snooze for how many minutes?" with title "bizneo-clock" default answer "20" buttons {"Cancel", "Snooze"} default button "Snooze")
  return r
on error
  return ""
end try
EOF
}
