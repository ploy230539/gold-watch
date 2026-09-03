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
| `email.mjs` | Email layout — the model supplies content, this owns every pixel |
| `gw.mjs` | The whole tool, one file, no dependencies |
| `data/log.json` | Track record — the call given each day, plus the actual outcome |
| `data/state.json` | Price-watch memory — the last price an alert was sent for |
| `data/history.json` | One price sample per scan; the Thai gold chart is drawn from it |
| `data/health.json` | When a scan last succeeded, so silence is never ambiguous |
| `data/targets.txt` | Price levels to be alerted on, one per line |
| `data/recipients.txt` | Who gets the emails, one address per line |
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
Thai bar and ornament gold with the association's announcement round
(api.chnwt.dev/thai-gold-api), and USD/THB (frankfurter.dev). It also returns `fair_thb`
and `premium_pct` already computed. If any source fails, the whole fetch fails loudly
rather than reporting a partial picture that could drive a wrong alert.

`scan` runs `prices`, applies the thresholds, prints the decision, and exits **0 when
nothing crossed the line, 10 when an alert is warranted**. `tasks/scan.cmd` uses that exit
code: below threshold it stops there and no model ever starts. The three daily price scans
therefore cost nothing on most days — the model is spent only on the runs that actually
produce an alert, where judgement is genuinely needed to explain the move.

The morning brief still needs the model for the analysis, but it takes its raw numbers
from `gw.mjs prices` and searches only for the news behind them.

### Price targets

`data/targets.txt` holds absolute levels, one per line:

```
thb  <= 66000   good re-entry level
spot >= 4400    world gold breaking out
```

Relative thresholds answer "did something happen"; targets answer "did the level I care
about get reached", which is the question people actually set alarms for. A target hit
always sends both an email and a push — you asked to be told. Unparseable lines are
reported in the alert rather than silently ignored, so a typo cannot sit there never firing.

### Emails

`node gw.mjs email --in content.json --out logs/email.html` renders the message from a
fixed layout in `email.mjs` and writes a plain-text alternative beside it. The jobs send
the HTML file as `htmlBody` and the text file as `body`.

The look used to drift every run because the model rebuilt the layout from scratch each
time. It does not any more: content is the model's job, layout is the template's. Inline
styles and table layout throughout, because Gmail strips `<style>` blocks in several of
its clients.

### Health — silence must not be ambiguous

If no scan has succeeded for 24 hours, an empty inbox means the watcher is down, not that
gold was quiet. `gw.mjs health` exits 11 in that case and `tasks/health.cmd` (12:07 daily)
emails a warning. While everything is healthy it costs nothing.

---

## Thresholds, hard-coded in `gw.mjs` (one place to change them)

| Constant | Rule |
|---|---|
| `ALERT_THB = 150` | Thai gold moved ≥ 150 THB from the last alerted price (cumulative) → alert |
| `ALERT_XAU_PCT = 1.5` | Spot moved ≥ 1.5% → alert |
| `--news` | Market-moving news → alert (a human decides this, not the script) |
| `PUSH_THB = 300` | Thai gold ≥ 300 THB → also send a phone push (150–300 is email only) |
| `PUSH_XAU_PCT = 1.5` | Spot ≥ 1.5% → also send a phone push |
| `MIN_ROWS_FOR_STATS = 30` | Below this, never quote an accuracy percentage |

Below threshold means total silence — nothing is sent at all.

The fair Thai gold price lives in `fairThb()` and in the calculator on the page:

```
(Spot ÷ 31.1035) × 15.244 × 0.965 × USDTHB
```

---

## Language

Tooling, code, and docs are in English. The **dashboard page and the emails stay in Thai**,
because that is what their readers read.

- **Email / dashboard** — polite, neutral Thai, the voice of a friendly analyst. Other
  people read these, so never use มึง/กู.
- **Chat / push** — casual Thai, มึง/กู is fine.

Recipients live in `data/recipients.txt`, one address per line. Edit that file to add or
remove someone — the next scheduled run picks it up, nothing to restart. It is the only
place addresses are written down.

---

## Scheduled jobs

Morning brief 08:00 (Mon–Sat) · Price scan **every 30 minutes, 08:30–22:00** (Mon–Sat) ·
Health check 12:07 daily · Self review 09:00 on the 1st of each month.

The scan went from three times a day to every half hour because it no longer costs
anything to run: the association re-announces 10–20 times a day, and three checks left
hours unwatched.

They run on Ploy's machine via Windows Task Scheduler — see [PROMPTS.md](PROMPTS.md) to install.
