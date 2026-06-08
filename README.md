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

## Install

```bash
npm install -g bizneo-clock
```

Requires **Node.js ≥ 18** and any installed **Chromium-based browser** (Chrome, Edge, Brave,
Arc, Vivaldi, …), used only for the one-time browser login — no extra browser is downloaded.
Firefox and Safari are not supported for login.

## Login

Bizneo logins often go through SSO (Microsoft/Google), so `bizneo-clock` doesn't ask for a
password. Instead it opens a browser, you sign in the way you normally do, and it captures
the resulting session.

```bash
bizneo-clock login --company ctaima
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
| `bizneo-clock out [--comment <text>]` | `finish`, `stop` | Clock out / finish work |

Notes:

- There are three states: **working**, **on a break** (paused), and **clocked out**. A break is
  not a clock-out — you leave it with `resume`, not `in`.
- Every command first checks your current state, so they're safe to run twice (e.g. `in` while
  already working does nothing; `resume` while working does nothing).
- `pause` lists your company's configured reasons. Pick interactively, or pass
  `--reason <id>` / `--reason <list-position>` to skip the prompt.
- After every action the tool re-reads your state from Bizneo and reports the real result
  rather than assuming the request worked.

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

- **"Could not launch a browser"** — install a Chromium-based browser (Chrome, Edge, Brave…).
- **"session has expired"** — run `bizneo-clock login` again.
- **403 on an action** — the session/CSRF went stale; re-run `bizneo-clock login`.

## Disclaimer

Unofficial tool, not affiliated with Bizneo. It talks only to your own company's Bizneo
instance using your own session. Use it in line with your employer's time-tracking policy.

## License

MIT
