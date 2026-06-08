#!/usr/bin/env bash

notify() {
  /usr/bin/osascript -e "display notification \"$2\" with title \"$1\"" >/dev/null 2>&1 || true
}

dlg_clockin() {
  /usr/bin/osascript - "$1" <<'EOF' 2>/dev/null
on run argv
  set snz to item 1 of argv
  try
    tell application "System Events"
      activate
      set b to button returned of (display dialog "Ready to start work?" with title "bizneo-clock" buttons {"Skip today", "Snooze " & snz & "m", "Clock in"} default button "Clock in" with icon note giving up after 120)
    end tell
    return b
  on error
    return ""
  end try
end run
EOF
}

dlg_clockout() {
  /usr/bin/osascript - "$@" <<'EOF' 2>/dev/null
on run argv
  tell application "System Events" to activate
  set c to choose from list argv with title "bizneo-clock" with prompt "Time to wrap up — clock out?" default items {item 1 of argv}
  if c is false then
    return ""
  else
    return item 1 of c
  end if
end run
EOF
}

dlg_show() {
  /usr/bin/osascript - "$1" <<'EOF' 2>/dev/null
on run argv
  set msg to item 1 of argv
  try
    tell application "System Events"
      activate
      display dialog msg with title "bizneo-clock (demo)" buttons {"OK"} default button "OK" with icon note giving up after 90
    end tell
  end try
end run
EOF
}

dlg_test() {
  /usr/bin/osascript <<'EOF' 2>/dev/null
try
  tell application "System Events"
    activate
    display dialog "bizneo-clock reminders are set up. This is just a test — approve any permission prompt that appears. No clock action is taken." with title "bizneo-clock (test)" buttons {"Great"} default button "Great" with icon note giving up after 60
  end tell
end try
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
