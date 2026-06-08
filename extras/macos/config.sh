#!/usr/bin/env bash
# ============================================================================
# bizneo-clock reminders — single source of configuration.
# Edit this file, then re-run install.sh (only needed when you change LABEL or
# TICK_SECONDS; time/snooze/day changes are picked up automatically).
# ============================================================================

# launchd agent label (change only if you know why; re-run install.sh after).
LABEL="com.jdvivar.bizneo-clock.watcher"

# How often the watcher wakes to check, in seconds.
TICK_SECONDS=300

# Days the reminders are active: 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat 7=Sun.
ACTIVE_DAYS="1 2 3 4 5"

# Times in 24h HHMM (e.g. 700 = 07:00, 1730 = 17:30).
MORNING_START=700      # start the "clock in?" nudge from this time
MORNING_END=1100       # stop the morning nudge after this time
CLOCKOUT_REMIND=1730   # start the "clock out?" reminder from this time
AUTO_CLOCKOUT=2100     # force a clock-out at/after this time

# Snooze options offered in the clock-out dialog, in minutes (space-separated).
SNOOZE_PRESETS="15 30 45 60"

# Snooze used when a prompt is dismissed/ignored, in minutes.
SNOOZE_DEFAULT=15

# Where snooze/state files live.
STATE_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/bizneo-clock/reminders"
