# Scheduled jobs — now running on Ploy's machine

The URL that replaces the old Artifact everywhere (chat, push):

```
https://ploy230539.github.io/gold-watch/
```

The old Artifact `751af5ad-2435-4077-8879-2bd35a1ccaa8` is **retired**.

---

## Schedule

| Job | When | What runs |
|---|---|---|
| Morning brief | 08:00, Mon–Sat | `tasks/run.cmd morning.md` (model) |
| Price scan | every 30 min, 08:30–22:00, Mon–Sat | `tasks/scan.cmd` (code only) |
| Health check | 12:07 daily | `tasks/health.cmd` (code only) |
| Monthly self review | 09:00 on the 1st | `tasks/run.cmd review.md` (model) |
| Watchdog | hourly 10:17–22:17, Mon–Sat | GitHub Actions, `.github/workflows/watchdog.yml` |

Everything reaches Ploy as a push in the ntfy app. Email was switched off on 17 Nov 2026.

---

## Cost

The scans, the alerts and the health check are pure code and cost nothing. The morning
brief and the monthly review are the only jobs that use the model; the brief takes its
prices from the free feed and searches only for the news behind them.

---

## Easiest way — the control panel

Double-click **`Gold Watch.cmd`** in `D:\Claude_AI\Ploy\Gold`. Every action has a button.

- **Everyday** — rebuild page · publish to web · view track record · open dashboard,
  plus price fields to check whether the alert thresholds are met
- **Scheduled jobs** — run the morning brief or a price scan right now · install or
  remove the schedule
- **First-time setup** — buttons 1 → 2 → 3, in order

The status bar reports whether the Claude CLI is installed and how many of the 5 jobs
are registered.

Below is the same thing from the command line, if you prefer.

---

## Command-line setup — 3 steps

### 1. Install the Claude Code CLI

The machine only has the Claude Code desktop app, which Task Scheduler cannot invoke:

```bash
npm install -g @anthropic-ai/claude-code
```

### 2. Sign in, once

Press **2. Sign in** in the Gold Watch panel (it runs `claude auth login`). This needs a
human; it cannot be automated. Then press **3. Test Claude** to confirm it answers, and
**4. Phone push** to subscribe the phone to the ntfy topic and send a test push.
No connectors are needed — nothing is emailed, and pushes go through ntfy, not Claude.

### 3. Register the jobs

```bash
powershell -ExecutionPolicy Bypass -File tasks\setup-windows-tasks.ps1
```

Fire the first run immediately:

```bash
schtasks /Run /TN GoldWatch-Morning
```

Per-run logs land in `logs\`.

---

## Trade-offs worth knowing

- **The machine must be on.** A run missed while it was off is caught up once when it
  comes back (`StartWhenAvailable`), and the GitHub watchdog pushes if the scans go quiet
  for more than two hours. The 250 THB threshold accumulates from the last price actually
  alerted on, so a gap never breaks the comparison.
- The runner (`tasks/run.cmd`) passes `--dangerously-skip-permissions` because nobody is
  at the keyboard to approve prompts. Both prompts are fixed local files that take no
  external input. **Edit prompts only in `tasks/`.**
- Remove a job: `schtasks /Delete /TN GoldWatch-Morning /F` (one name at a time).

---

## Fallback — if you would rather not depend on the machine being on

The repo ships a GitHub Action (`.github/workflows/build.yml`) that fills the template,
validates it, and commits `docs/index.html`. To move the jobs back to claude.ai, connect a
GitHub connector there and have each job write only `data/payload-latest.json` to
`ploy230539/gold-watch` on `main` — the Action builds the rest. (Jobs on claude.ai have no
shell, so they cannot run `gw.mjs` themselves; the Action is the bridge.)

The Action is still active today as a safety net: every change under `data/` gets
re-validated in CI.

---

## The prompts themselves

Live in `tasks/morning.md` and `tasks/review.md`. The alert and health-alarm prompts
(`watch.md`, `health-alert.md`) were removed with email on 17 Nov 2026; both jobs are code
now.

Still intact: the fair-price formula · 1.5% Spot threshold · the 30-row rule · polite
neutral Thai (no มึง/กู) on the public dashboard. The Thai gold threshold is 250 THB
since 1 Nov 2026 (was 150).
