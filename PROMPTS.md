# Scheduled jobs — now running on Ploy's machine

The URL that replaces the old Artifact everywhere (email, CTA buttons, chat, push):

```
https://ploy230539.github.io/gold-watch/
```

The old Artifact `751af5ad-2435-4077-8879-2bd35a1ccaa8` is **retired**.

---

## Schedule

| Job | When | Prompt |
|---|---|---|
| Morning brief | 08:00, Mon–Sat | `tasks/morning.md` |
| Price scan | **10:00 / 15:00 / 20:00**, Mon–Fri | `tasks/scan.cmd` → `tasks/watch.md` only if an alert is due |
| Monthly self review | 09:00 on the 1st | `tasks/review.md` |

The scan times changed from the old 4 slots (09:00 / 12:00 / 15:00 / 18:00) to 3 slots
at 10:00 / 15:00 / 20:00, matching what section 10 of the `gold-watch` skill already said.

---

## Cost

The price scans decide in pure code and start a model only when a threshold is actually
crossed, so on a quiet day all three cost nothing. The morning brief always uses the model,
but takes its prices from the free feed and searches only for the news behind them.

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

### 2. Log in and connect the connectors, once

Open `claude` interactively in `D:\Claude_AI\Ploy\Gold`, log in, then connect the
connectors the jobs need — **Gmail** (sending mail) and **push notifications**. This step
needs a human; it cannot be automated. Skip it and the jobs will run but fail to send email.

Confirm it actually works before going further:

```bash
claude -p "Send a test email with subject 'Gold Watch system test' to iminiwindy@gmail.com"
```

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

- **The machine must be awake at the scheduled time.** A missed slot is skipped, never
  caught up (`/SC WEEKLY` in schtasks does no catch-up).
  This does not break the price watch: the 150 THB threshold accumulates from the last
  price an alert was **actually sent** for, so the next run still compares correctly.
- The runner (`tasks/run.cmd`) passes `--dangerously-skip-permissions` because nobody is
  at the keyboard to approve prompts. All three prompts are fixed local files that take no
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

Live in `tasks/morning.md`, `tasks/watch.md`, `tasks/review.md`.

Everything carried over intact: the fair-price formula · the 150/300 THB and 1.5%
thresholds · the strong-push rule · the 30-row rule · polite Thai email tone with no
มึง/กู · both recipients.
