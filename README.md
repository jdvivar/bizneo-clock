# bizneo-clock

[![CI](https://github.com/jdvivar/bizneo-clock/actions/workflows/ci.yml/badge.svg)](https://github.com/jdvivar/bizneo-clock/actions/workflows/ci.yml)

Clock in and out of [Bizneo HR](https://www.bizneo.com/) (the *chrono* / time-tracking
feature) straight from your terminal.

```bash
bizneo-clock in       # start work
bizneo-clock pause    # take a break (pick a reason)
bizneo-clock resume   # back to work after a break
bizneo-clock out      # finish for the day
bizneo-clock status   # am I working, on a break, or clocked out?
```

**On macOS, it can also remind you.** An optional background agent asks you to clock in when
you start your day, reminds you to clock out in the evening (with snooze), and clocks you out
automatically if you forget. See [macOS reminders](#macos-reminders).

## Install

```bash
npm install -g bizneo-clock
```

Requires **Node.js ≥ 18** and an installed **Chromium-based browser** (Chrome, Edge, Brave or
Chromium), used only for the one-time browser login. No extra browser is downloaded. Firefox
and Safari aren't supported for login, and neither are Vivaldi or Arc. To use a different
Chromium-based browser, point `BIZNEO_CLOCK_BROWSER` at its executable.

## Login

Bizneo logins often go through SSO (Microsoft/Google), so `bizneo-clock` doesn't ask for a
password. Instead it opens a browser, you sign in the way you normally do, and it captures
the resulting session.

```bash
bizneo-clock login --company acme
# or just: bizneo-clock login   (it'll ask for your company subdomain)
```

A browser window opens at `https://<company>.bizneohr.com`. Complete the sign-in (including
any 2FA). As soon as you're in, the tool grabs your session, prints your employee id, and
closes the browser.

The session lasts about **30 days** and **auto-renews every time you use the tool**, so in
practice you log in once and forget about it. When it finally expires, any command will tell
you to run `bizneo-clock login` again.

## Commands

| Command | Aliases | What it does |
| --- | --- | --- |
| `bizneo-clock login [-c <company>]` | | Sign in via the browser and store the session |
| `bizneo-clock logout` | | Remove the stored session |
| `bizneo-clock status [--json]` | | Show whether you're working, on a break, or clocked out |
| `bizneo-clock in` | `start` | Clock in (start work) |
| `bizneo-clock pause [-r <id>] [--comment <text>]` | | Take a break with a reason (lunch, break…) |
| `bizneo-clock resume` | | Resume after a break (or clock in if fully clocked out) |
| `bizneo-clock out [--comment <text>]` | `finish`, `stop` | Clock out / finish work (ends a break first if you're on one) |

Notes:

- There are three states: **working**, **on a break** (paused), and **clocked out**. A break is
  not a clock-out — you leave it with `resume`, not `in`.
- Every command first checks your current state, so they're safe to run twice (e.g. `in` while
  already working does nothing; `resume` while working does nothing).
- `pause` lists your company's configured reasons. Pick interactively, or pass
  `--reason <id>` / `--reason <list-position>` to skip the prompt.
- After every action the tool re-reads your state from Bizneo and reports the real result
  rather than assuming the request worked.
- **Exit codes** (for scripts): `0` means you're in the requested state, either because the
  action worked or because you already were. `1` means it didn't happen: the request didn't
  take effect, or the command doesn't apply to your current state (e.g. `in` while on a
  break, or `pause` while clocked out).

## macOS reminders

Forgetting to clock in or out is the main way time records go wrong, so the repo includes
an optional `launchd` agent that keeps an eye on it. It uses native macOS dialogs and checks
your real state with `bizneo-clock status --json`, so it never nags you about something
you've already done.

| When (weekdays) | What happens |
| --- | --- |
| **07:00–11:00**, if you're clocked out | "Ready to start work?" with **Clock in** / Snooze / Skip today |
| **From 17:30**, if you're working or on a break | "Time to wrap up?" with **Clock out now** / Snooze 15–60 min / Custom |
| **21:00**, if you're still clocked in | Clocks you out automatically and tells you (a dialog plus a notification) |

Working late on purpose? A session you start after 21:00 is left alone: no reminders, and
the automatic clock-out moves to 02:00. A forgotten break is handled too: the agent ends it
before clocking out.

It isn't part of the npm package, so install it from a clone of this repo. The agent runs
the scripts from wherever you clone it, so keep the clone around:

```bash
git clone https://github.com/jdvivar/bizneo-clock.git
bash bizneo-clock/extras/macos/install.sh   # needs bizneo-clock installed and logged in
bash bizneo-clock/extras/macos/test.sh      # shows a test dialog; approve macOS's permission prompt
```

All times, days and snooze options live in one file,
[`extras/macos/config.sh`](./extras/macos/config.sh). For the details (behaviour, logs,
uninstalling), see [`extras/macos/README.md`](./extras/macos/README.md).

## How it works

Bizneo's web app (Phoenix + HTMX) drives clocking through:

- `GET  /chrono/{employeeId}/hub_chrono` — the live chronometer fragment (current state,
  CSRF token, shift id, pause reasons)
- `POST /chrono` — clock in
- `PUT  /chrono/{employeeId}` — clock out, or pause (with a `pause=<reasonId>` field)

For each command `bizneo-clock` reads the chronometer fragment to get a fresh CSRF token and
the current shift, then submits the matching request with your stored session cookie.

## Privacy & storage

- Your session is stored locally at `~/.config/bizneo-clock/config.json` (permissions `600`).
- It contains your Bizneo session cookie, company host, employee id, and the user-agent used
  at login. Nothing is sent anywhere except to your own company's Bizneo instance.
- `bizneo-clock logout` deletes that file.

## Troubleshooting

- **"Could not launch a browser"**: install Chrome, Edge, Brave or Chromium, or set
  `BIZNEO_CLOCK_BROWSER=/path/to/browser` for another Chromium-based browser.
- **"session has expired"** — run `bizneo-clock login` again.
- **403 on an action** — the session/CSRF went stale; re-run `bizneo-clock login`.

## Development & design

- [`AGENTS.md`](./AGENTS.md) — quick orientation for humans/AI: layout, commands, conventions.
- [`docs/DESIGN.md`](./docs/DESIGN.md) — the reasoning: reverse-engineered Bizneo mechanics,
  decisions, and the hard-won gotchas (auth, the 3-state pause model, the release pipeline).
- [`extras/macos/`](./extras/macos/) — the optional macOS reminders (see [above](#macos-reminders)).

## Disclaimer

Unofficial tool, not affiliated with Bizneo. It talks only to your own company's Bizneo
instance using your own session. Use it in line with your employer's time-tracking policy.

## License

MIT
