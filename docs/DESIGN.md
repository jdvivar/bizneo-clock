# bizneo-clock — Design & Reasoning

The "how and why" behind this tool, plus the hard-won gotchas. If you're picking this up
again (human or AI), read this first, then `AGENTS.md` for the quick command reference.

`bizneo-clock` is a personal CLI to clock in/out of **Bizneo HR** (the *chrono* /
time-tracking feature) from the terminal, published as a global npm bin.

---

## 1. The Bizneo target (reverse-engineered)

The CLI is an alternative client for the Bizneo web app's own internal endpoints — **not**
Bizneo's official paid REST API. Everything below was derived from observing the web app's
network traffic and reading the rendered HTML.

- **Backend:** Phoenix (Elixir) + **HTMX**. Evidence: the `_hcmex_key` signed-session cookie
  (`SFMyNTY.` = `Plug.Crypto`/`Phoenix.Token`) and `hx-*` request headers. This matters
  because **CSRF is enforced** (Phoenix masks the token per render).
- **Auth:** the **`_hcmex_key`** session cookie (+ `device_id`). The server re-issues
  `_hcmex_key` on every response with `max-age=2592000` → a **30-day sliding expiry** that
  auto-renews on use. So: log in once, works for weeks.
- **Login is Microsoft SSO** for our company. That's why we don't script credentials — see
  decision §2.1.
- **`{userId}`** (e.g. `18496179`) is the employee id, stable, and discoverable from the home
  page (`hx-get="/chrono/<userId>/hub_chrono"`).

### Endpoints

| Purpose | Request |
| --- | --- |
| Live state + fresh tokens | `GET /chrono/{userId}/hub_chrono` (HTMX fragment) |
| Clock in (start / resume-from-out) | `POST /chrono` |
| Clock out / pause / resume-from-break | `PUT /chrono/{userId}` (real PUT, body also has `_method=put`) |

### The `hub_chrono` fragment is the single source of truth

Each command does **scrape-then-act**: GET the fragment, parse current state + a fresh masked
`_csrf_token` + `shift_id` + buttons, then issue the matching request. This is resilient to
CSRF rotation and shift changes (don't hardcode `shift_id` or tokens).

### Three states (this is subtle — see gotcha §5.2)

| State | How detected in the fragment | What you can do |
| --- | --- | --- |
| **working** | a PUT form (`_method=put`) with `data-gtm-action="chrono pause"` buttons + a `chrono stop` button | pause, finish |
| **paused** (on a break) | a single button `data-gtm-action="chrono stop rest"` labelled **"Reanudar"** | resume |
| **out** | a POST form (no `_method=put`), clock-in button | clock in |

A break is **not** a clock-out: the chrono session stays open, the timer keeps a `data-from`,
and you leave it with a *resume*, not a clock-in.

### Exact request bodies (urlencoded; replay with a fresh `_csrf_token` + `x-csrf-token` header)

| Action | Method / path | Body fields |
| --- | --- | --- |
| Clock in | `POST /chrono` | `_csrf_token`, `location_id=`, `user_id`, `shift_id` |
| Finish | `PUT /chrono/{userId}` | `_method=put`, `_csrf_token`, `location_id=`, `shift_id`, `kind=rest`, `comment=` |
| Pause | `PUT /chrono/{userId}` | finish fields **+ `pause=<reasonId>`** |
| Resume | `PUT /chrono/{userId}` | `_method=put`, `_csrf_token`, `location_id=`, `shift_id`, `comment=`, **`pause=<resumeValue>`** (no `kind`) |

- Pause reasons are per-company (we saw `35018` *Desayuno*, `35020` *Comida*), scraped from the
  `button[name="pause"][data-gtm-action="chrono pause"]` elements — **don't hardcode them**.
- The "Reanudar" button reuses a `pause` value; resume submits it with **no `kind`** field.
- Elapsed time: the timer span carries `data-from="YYYY-M-D H:MM:SS"` + `data-time-zone`; we
  compute elapsed ourselves (see `src/time.ts`). After a resume, Bizneo resets `data-from` to
  the resume moment — expected, not a bug.

---

## 2. Architecture decisions

### 2.1 Auth = browser-captured session cookie (not SSO scripting, not the official API)

- **Rejected: scripting the Microsoft SSO login** — breaks on MFA/conditional access and would
  need a bundled headless browser. Fragile.
- **Rejected: Bizneo's official REST API** — requires a paid API tier + token the company
  doesn't expose; it isn't what `/chrono` is.
- **Chosen:** `login` opens a real browser (Playwright `channel` → the user's installed
  **Chromium-based** browser, so **no ~150 MB browser download**), the user signs in normally,
  and we capture cookies once the `hub_chrono` route is reachable. Firefox/Safari can't work
  with the `channel` approach — Playwright only drives its own downloaded Firefox build.

### 2.2 Generic / company-agnostic

The published bin hardcodes nothing company-specific. Host (`<company>.bizneohr.com`),
`userId`, `shift_id`, and pause reasons are all discovered at runtime. Examples in docs use
`acme` deliberately.

### 2.3 Config / storage

Session lives in `~/.config/bizneo-clock/config.json` (chmod 600): host, userId, cookies,
userAgent, savedAt. The HTTP client absorbs `Set-Cookie` on every response and re-saves, which
is what keeps the 30-day session alive.

---

## 3. Code map (`src/`)

| File | Responsibility |
| --- | --- |
| `cli.ts` | commander wiring; each command wrapped to print friendly errors |
| `config.ts` | load/save the session file |
| `client.ts` | authed `fetch` wrapper: cookie header, hx headers, CSRF header, cookie refresh, `SessionExpiredError` |
| `chrono.ts` | `getState()` (parse the fragment) + `clockIn` / `finish` / `pause` / `resume` builders + the 3-state model |
| `session.ts` | Playwright browser login + `userId` discovery |
| `time.ts` | pure helpers: parse `data-from`, compute elapsed across a time zone, format duration |
| `ui.ts` | status formatting + pause-reason picker |
| `context.ts` | `requireClient()` + persist refreshed cookies |
| `commands/*` | one file per command group |

---

## 4. Release & ops pipeline

- **Conventional Commits → release-please.** Merging the auto-generated "Release PR" tags the
  version, writes `CHANGELOG.md`, **and publishes to npm in the same job**.
- **Pre-1.0 bumps are patches** (`bump-patch-for-minor-pre-major: true`): `feat:`/`fix:` →
  patch, breaking → minor. Revisit at 1.0.
- **`extras/` is excluded from the npm package** via `package.json` `files`.

---

## 5. Gotchas (the expensive lessons — check here first when something breaks)

### 5.1 Phoenix masked CSRF
Every render produces a different masked `_csrf_token`; all validate against the session token.
So scrape a fresh one per action; reusing a stale one *usually* works but don't rely on it.

### 5.2 Pause vs resume is a toggle, not clock-in/out (caused a real bug)
A break keeps you "in" the chrono session, so naive `clockedIn` detection thinks you're
working and `resume`/`in` no-op. Resume is `PUT … pause=<resumeValue>` (the "Reanudar"
button), **not** `POST /chrono`. Hence the explicit **3-state** model.

### 5.3 npm publish failed with `EOTP`
The account has 2FA "auth + writes". A classic **Publish** token still demands an OTP in CI.
Fix: use an **Automation** token, or a **Granular** token with **"Bypass two-factor
authentication" checked**. (We hit this because the granular token was created without the
bypass box ticked.)

### 5.4 `GITHUB_TOKEN`-created releases don't trigger `on: release` workflows
GitHub's loop-prevention. So a separate `publish.yml` on `release: published` never fired.
**Fix:** the npm publish step lives **inside the release-please job**, gated on
`steps.release.outputs.release_created`. `publish.yml` is kept only as a manual
(`workflow_dispatch`) recovery/escape hatch.

### 5.5 "GitHub Actions is not permitted to create or approve pull requests"
release-please can't open its PR until repo **Settings → Actions → General → Workflow
permissions → "Allow GitHub Actions to create and approve pull requests"** is enabled.

### 5.6 Releasing a state that didn't auto-publish
If a version got tagged but not published (e.g. the token bug), the auto-path won't re-publish
it. Either run the manual `publish.yml`, or move forward with a new release. To force a
specific version without rewriting history, push an empty commit with a `Release-As: x.y.z`
footer (we used this for `0.1.4`).

### 5.7 npmjs.com website lags the registry
`npm view <pkg> version` (registry API) is instant; the website's versions tab is CDN-cached
and updates minutes later. Not a bug.

### 5.8 launchd + nvm
The launchd agent has a minimal `PATH` and the bin's shebang is `#!/usr/bin/env node`.
`install.sh` resolves `dirname $(command -v bizneo-clock)` (which also contains `node` under
nvm) and bakes it into the agent's `PATH`. If the user changes their default Node version, the
global bin path changes → re-run `install.sh`.

---

## 6. macOS reminders (`extras/macos/`)

A local **`launchd` LaunchAgent** (not a Mac app) that nudges clock-in in the morning, reminds
clock-out from 17:30 with snooze, and force-clocks-out at 21:00. Native dialogs via
`osascript`. State-aware via `bizneo-clock status --json`; snoozes are timestamp files
(sleep-proof).

- **One declarative config:** `extras/macos/config.sh` holds every knob (label, tick interval,
  active days, the four times, snooze presets). `watch.sh`, the dialogs, the plist template,
  and install/uninstall/test/demo all derive from it.
- A single watcher ticks every `TICK_SECONDS` and dispatches by time-of-day, rather than three
  separate timers — simpler and resilient to sleep (missed ticks fire on wake).
- `test.sh` (permission check) and `demo.sh` (runs `bizneo-clock status` via the agent) route
  *through the agent* so macOS attributes the Automation/Notification permission to the agent.

---

## 7. Future ideas

- **Menu-bar presence**: a SwiftBar/xbar plugin (low effort, reuses the CLI) or a real Swift
  menu-bar app (most native). Would give an at-a-glance 🟢/⏸/⚪ state and click-to-act, and
  could replace the launchd reminders.
- A `--location`/geo flag if a company requires geolocation on clock actions (we currently send
  `location_id=` empty).
- Other `kind` values beyond `rest` if a company exposes them.
