# AGENTS.md

Orientation for humans and AI agents working on this repo. For the deep "how & why" (the
reverse-engineered Bizneo mechanics and the hard-won gotchas), read **`docs/DESIGN.md`**.

## What this is

`bizneo-clock` — a personal CLI to clock in/out of Bizneo HR (the *chrono* feature) from the
terminal, published as a global npm bin. TypeScript, compiled with `tsc`, zero-config runtime
(native `fetch`). Browser login via `playwright-core`. Talks to the Bizneo web app's own
endpoints using a captured session cookie (not the official API, not scripted SSO).

## Repo layout

```
src/            TypeScript source (see the code map in docs/DESIGN.md §3)
dist/           tsc output (published)
extras/macos/   launchd reminder agent — NOT published; all config in config.sh
docs/DESIGN.md  design rationale, Bizneo mechanics, gotchas
```

## Commands

```bash
npm run build        # tsc -> dist/
node dist/cli.js …    # run locally (login | status | in | out | pause | resume | logout)
```

There are no automated tests; verification has been done by running real commands against a
live account (with the user's consent — clock effects are seconds and get restored).
`bizneo-clock status --json` exists for scripting/verification.

## Conventions (important)

- **Conventional Commits.** `feat:`/`fix:` → release-please opens a Release PR; **merging it
  tags + publishes to npm automatically** (publish runs inside the release-please job — see
  `docs/DESIGN.md` §5.4). Pre-1.0, both bump a patch.
- **`docs:`/`chore:` do not release** — use them for changes that don't alter the published
  package (e.g. anything under `extras/`, which is excluded from the npm tarball).
- **No code comments** unless explicitly requested (this is a standing preference).
- **Company-agnostic:** never hardcode a company host / ids / pause reasons; discover them at
  runtime. Use `acme` in examples.
- **Don't duplicate Bizneo response shapes** by hand more than necessary; parse from the live
  `hub_chrono` fragment.

## Git / release

- Personal repo: https://github.com/jdvivar/bizneo-clock. Local identity is set per-repo
  (`jdvivar <jdvivar@gmail.com>`); the remote uses the `github-personal` SSH host alias.
- Release: land conventional commits → merge the release-please PR → npm publish happens
  automatically (`NPM_TOKEN` secret must be an Automation or "bypass-2FA" Granular token).
- Manual/recovery publish: the `publish.yml` workflow (`workflow_dispatch`).

## Requirements

Node ≥ 18, and (for `login`) an installed Chromium-based browser (Chrome/Edge/Brave/…).
