# Gold Watch

Ploy's gold-price dashboard, plus the script the three scheduled jobs call.

**Public page (no login required):** https://ploy230539.github.io/gold-watch/

---

## Why it moved here

The dashboard used to be published as a Claude Artifact, which is private — anyone
without a Claude account could not open it. It now lives on GitHub Pages: a stable
permanent URL, open to everyone, with git history so you can look back at what the
page said on any given day. The old setup simply overwrote itself each run.

---

## Layout

| Path | What it is |
|---|---|
| `template.html` | Dashboard template with `{{...}}` placeholders |
| `email.mjs` | Email layout — unused since email was switched off on 17 Nov 2026 |
| `gw.mjs` | The whole tool, one file, no dependencies |
| `data/log.json` | Track record — the call given each day, plus the actual outcome |
| `data/state.json` | Price-watch memory — the last price an alert was sent for |
| `data/history.json` | One price sample per scan; the Thai gold chart is drawn from it |
| `data/health.json` | When a scan last succeeded, so silence is never ambiguous |
| `data/targets.txt` | Price levels to be alerted on, one per line |
| `data/recipients.txt` | The old email list — not in use, kept for switching email back on |
| `payload.example.json` | Fully commented example payload |
| `tasks/` | The three job prompts, the runner, and the Task Scheduler installer |
| `Gold Watch.cmd` | Control panel window (double-click to open) |
| `gold-watch.ico` | App icon used by the desktop shortcut |
| `docs/index.html` | What GitHub Pages serves — generated only, never edit by hand |

---

## Control panel

Double-click the **Gold Watch** icon on the desktop (or `Gold Watch.cmd` in this folder).
Every action has a button — no typing required. To recreate the desktop shortcut:

```bash
powershell -ExecutionPolicy Bypass -File tasks\create-desktop-shortcut.ps1
```

Readable output is the default in the panel; every command also has a raw JSON form for
scripts — drop `--pretty` to get it.

---

## Commands

```bash
node gw.mjs morning --in payload.json    # fill due results + append today's row + build page
node gw.mjs build   --in payload.json    # build the page only, leave the log alone
node gw.mjs publish -m "commit message"  # push to GitHub Pages
node gw.mjs check --thb 71500 --xau 4620 # has it moved enough to alert?
node gw.mjs state set --thb 71500 --xau 4620   # record the price just alerted on
node gw.mjs state get                    # show the current reference price
node gw.mjs log                          # print the track record as JSON
node gw.mjs prices --pretty              # live prices from free APIs, no model
node gw.mjs check --thb N --xau N --pretty     # readable instead of JSON
node gw.mjs scan                         # prices + thresholds; exit 10 = alert needed
node gw.mjs health --pretty              # is the watcher still watching? exit 11 = stale
node gw.mjs targets                      # list the price levels being watched
node gw.mjs watchdog [--force] [--dry]   # cloud check: has the heartbeat gone quiet?
node gw.mjs notify --preset health|morning-fallback|alert-fallback [--dry]
```

### `morning` / `build`

Takes a payload of **facts only** (prices, news, support/resistance). The script does
the rest:

- Computes ladder positions — `bottom% = (price − range low) ÷ (range high − range low) × 100`,
  padding both ends by 8% of the span so markers never sit flush against the rail
- Picks tile colours and up/down arrows from the sign of each number
- Assembles the HTML for drivers, calendar, sources, and the track-record table
- Writes the note under the table according to the **30-row rule**
- **Validates that every placeholder is filled before writing anything.** If even one
  is left, it errors out and writes nothing at all.

Fields that genuinely could not be fetched go in as `null` (`rsi`, `thb_orn.sell/delta`)
and the page renders `—`. **Never substitute a guess.**

`morning` does two more things: it fills `actual_result` for every row that has reached
its `actual_due_iso` (close-to-close against today's price; a move under ±0.5% counts as
a draw, since it does not clear the shop's bid/ask spread), then appends today's row. No
more looking up historical prices by hand.

### `check` / `state`

Replaces reading the `[TH ... | XAU ...]` code off the email subject line — that state now
lives in `data/state.json`. It is more reliable because it does not depend on a Gmail
search and does not break if an email is deleted or missed. The subject-line code is still
appended to every alert: `check` returns it as `subject_code`, so readers can see which
price the comparison was against, and it can be used to rebuild the state file if lost.

`check` returns JSON: `alert`, `push`, `channels`, `reason`, `thb_move`, `xau_pct`, `subject_code`.

Call `state set` **only when an alert was actually sent**, otherwise the cumulative
threshold drifts.

### `prices` / `scan` — the model-free path

`prices` pulls live figures from three free, keyless APIs: Gold Spot (api.gold-api.com),
Thai bar and ornament gold with the association's announcement round, and USD/THB
(frankfurter.dev). Thai gold comes from the association's own feed
(goldtraders.or.th/api/GoldPrices/Latest), with the community mirror api.chnwt.dev as a
fallback. Until 12 Nov 2026 the mirror was the only source; it went down on 10 Nov and
every scan failed for two days. It also returns `fair_thb`
and `premium_pct` already computed. If any source fails, the whole fetch fails loudly
rather than reporting a partial picture that could drive a wrong alert.

`scan` runs `prices`, applies the thresholds, sends the phone push itself when one trips,
and exits **0 when nothing crossed the line, 10 when it alerted**. No model is involved at
any point, so the scans cost nothing at all.

The morning brief is the only job that still needs the model — for the analysis — and it
takes its raw numbers from `gw.mjs prices` and searches only for the news behind them.

### Price targets

`data/targets.txt` holds absolute levels, one per line:

```
thb  <= 66000   good re-entry level
spot >= 4400    world gold breaking out
```

Relative thresholds answer "did something happen"; targets answer "did the level I care
about get reached", which is the question people actually set alarms for. A target hit
always pushes at high priority — you asked to be told. Unparseable lines are
reported in the alert rather than silently ignored, so a typo cannot sit there never firing.

### Email is off

Since 17 Nov 2026 nothing is emailed — Ploy asked for the ntfy app only. Everything that
used to be an email is now a push, or is gone:

| Was | Now |
|---|---|
| Morning email | Morning push only (it was already the message she read) |
| Alert email (≥ 250 THB) | Every alert is a push, sent from code; the model no longer runs on alerts |
| Health-alarm email | Push only — it was always sent first anyway |

What was lost: the alert email's "why it moved" from a news search, and the second
recipient, who no longer receives anything. The email code (`email.mjs`, `gw.mjs email`)
and `data/recipients.txt` are kept; the prompts that sent mail (`tasks/watch.md`,
`tasks/health-alert.md`) are in git history. Switching back means restoring those, the
email step in `tasks/morning.md`, and the model call in `tasks/scan.cmd` / `health.cmd`.

### What gets sent

Ploy follows the price moving and what to do about it; she does not read tables or
charts. So everything sent to her leads with a **call** — ซื้อ (`buy`), ถือ (`hold`),
ขาย (`sell`), รอ (`wait`) — a one-line reason, and the price that would prove it wrong.

- **Morning push** — title `ทองแท่ง 68,850 · ถือ`, then the move, the reason, and
  `ผิดถ้า: ...`.
- **Alert push** (from the scan, no model) — the move, plus the morning call quoted from
  `call_reason` in the track record, dated if it is not today's. Moves of 250–299 THB ring
  at normal priority; ≥ 300 THB, Spot ≥ 1.5%, news and target hits ring at high priority.

The dashboard keeps its charts and tables for anyone who wants the detail.

`sell` is scored like `wait` in the track record: right if the price then fell.

### Phone push (ntfy)

Claude's own push tool only reaches a phone when Remote Control is attached, and a
scheduled headless run never has that — so from the move until 21 Sep 2026 every push
quietly failed. Pushes now go through
[ntfy](https://ntfy.sh): a plain HTTP POST, no account, no model.

- `node gw.mjs push-setup` creates a private topic and prints how to subscribe to it
- `node gw.mjs notify --title T --message M` sends one; `--preset health` sends the
  watchdog alarm and `--dry` prints instead of sending. **Never type Thai into a `.cmd`
  file** — cmd.exe reads it as code page 874 and the phone receives mojibake. Put the text
  in a preset in `gw.mjs` and call it by name.
- `scan` sends the push itself, straight from code, the moment a threshold trips
- a delivered push advances the reference price; a failed one does not, so the next scan
  tries the same move again. (When the reference used to wait for the email, a broken
  send path re-pushed the same move about 27 times a day.)

The topic lives in `local/ntfy-topic.txt`, which is gitignored. **This repo is public, and
anyone who has the topic can read every push sent to it** — it must never be committed.

### Health — silence must not be ambiguous

Two separate things have to be working, and they fail in different ways:

- **The price feed** — pure code, almost never breaks. Stale after 24h without a
  successful scan. A gap here usually means the machine was off or asleep, not that
  anything is wrong with the system.
- **Delivery** — the alert pushes and the morning brief. The Claude CLI login expired on
  29 Sep 2026 and every morning brief failed for 20 days while the feed kept reporting
  "OK", so the watchdog said everything was fine and nothing reached Ploy. Every alert
  push and every morning run now records whether it got through; three failures in a row
  raises the alarm.

`gw.mjs health` exits 11 if either is broken. `tasks/health.cmd` (12:07 daily) warns, and
`--record-send` raises it the moment delivery breaks rather than waiting for the next day.

**The alarm is a plain-code ntfy push.** A warning that needs the model to announce that
the model is broken never arrives — that is the whole reason the three-week outage went
unnoticed.

### Self-repair — what fixes itself, and what tells you

Every way this has broken so far, and what happens now:

| Failure | What happens |
|---|---|
| Thai price source down (10 Nov 2026) | Falls back to the mirror. Each source gets 3 tries |
| Spot or USD/THB source down | Uses the Spot and baht rate the association priced against |
| Claude login expired / CLI missing | Scans and alerts never needed it; a code-only push replaces the morning brief |
| PC off, asleep, or offline | **GitHub Actions watchdog** pushes within ~2h |

The last row is the one nothing on the PC can report, because it is off too. Every
good scan leaves a silent heartbeat on `<topic>-hb` (nobody subscribes to it), and
`.github/workflows/watchdog.yml` reads it hourly, 10:17–22:17 Mon–Sat Bangkok time. A gap
over 2h pushes once per outage (repeated at most every 6h), and a "back to normal" push
follows when the heartbeat returns, so a quiet watchdog means "still fine".

It needs one repository secret, `NTFY_TOPIC` (set on 12 Nov 2026). To set it again from
the file, without the value passing through a terminal or chat — in PowerShell, which has
no `<` redirection:

```powershell
Get-Content D:\Claude_AI\Ploy\Gold\local\ntfy-topic.txt -Raw | gh secret set NTFY_TOPIC --repo ploy230539/gold-watch
```

The repo and its Actions logs are public: the topic only ever comes from the secret,
and `gw.mjs watchdog` never prints it. Run it by hand from the Actions tab
(`force` checks outside scan hours too).

---

## Thresholds, hard-coded in `gw.mjs` (one place to change them)

| Constant | Rule |
|---|---|
| `ALERT_THB = 250` | Thai gold moved ≥ 250 THB from the last alerted price (cumulative) → alert |
| `ALERT_XAU_PCT = 1.5` | Spot moved ≥ 1.5% → alert |
| `--news` | Market-moving news → alert (a human decides this, not the script) |
| `PUSH_THB = 300` | Thai gold ≥ 300 THB → the push rings at high priority |
| `PUSH_XAU_PCT = 1.5` | Spot ≥ 1.5% → high priority |
| `MIN_ROWS_FOR_STATS = 30` | Below this, never quote an accuracy percentage |

Below threshold means total silence — nothing is sent at all. Every alert is a push, and
all of them are measured from `last_alert`.

`ALERT_THB` was 150 until 1 Nov 2026. A 1,100 THB slide on 30 Oct sent four emails in six
hours, which reads as noise; at 250 it would have sent two. While email was on, pushes
had their own 300 THB threshold and their own baseline (`last_push`), because sharing the
email's baseline made a steady slide never reach 300.

The fair Thai gold price lives in `fairThb()` and in the calculator on the page:

```
(Spot ÷ 31.1035) × 15.244 × 0.965 × USDTHB
```

---

## Language

Tooling, code, and docs are in English. The **dashboard page and the pushes are in Thai**,
because that is what their readers read.

- **Dashboard** — polite, neutral Thai, the voice of a friendly analyst. It is public and
  other people read it, so never use มึง/กู.
- **Chat / push** — casual Thai, มึง/กู is fine.

---

## Scheduled jobs

Morning brief 08:00 (Mon–Sat) · Price scan **every 30 minutes, 08:30–22:00** (Mon–Sat) ·
Health check 12:07 daily · Self review 09:00 on the 1st of each month.

The scan went from three times a day to every half hour because it no longer costs
anything to run: the association re-announces 10–20 times a day, and three checks left
hours unwatched.

The jobs are registered with `AllowStartIfOnBatteries`, `DontStopIfGoingOnBatteries` and
`StartWhenAvailable`. schtasks defaults to the opposite of the first two, which quietly
refused every run while the laptop was unplugged — the task log showed 0x800710E0 and
nothing else. The third means a run missed while the machine was off is picked up when
it comes back, instead of being skipped.

They run on Ploy's machine via Windows Task Scheduler — see [PROMPTS.md](PROMPTS.md) to install.
