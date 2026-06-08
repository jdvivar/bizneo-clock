#!/usr/bin/env bash
# bizneo-clock reminder settings. Times are 24h HHMM (e.g. 700 = 07:00, 1730 = 17:30).

MORNING_START=700      # start the "clock in?" nudge from this time
MORNING_END=1100       # stop the morning nudge after this time
CLOCKOUT_REMIND=1730   # start the "clock out?" reminder from this time
AUTO_CLOCKOUT=2100     # force a clock-out at/after this time

STATE_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/bizneo-clock/reminders"
