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
| `template.html` | Dashboard template with 44 `{{...}}` placeholders (copied from Drive, structure untouched) |
| `gw.mjs` | The whole tool, one file, no dependencies |
| `data/log.json` | Track record — the call given each day, plus the actual outcome |
| `data/state.json` | Price-watch memory — the last price an alert was sent for |
| `payload.example.json` | Fully commented example payload |
| `tasks/` | The three job prompts, the runner, and the Task Scheduler installer |
| `Gold Watch.cmd` | Control panel window (double-click to open) |
| `docs/index.html` | What GitHub Pages serves — generated only, never edit by hand |

---

## Control panel

Double-click `Gold Watch.cmd`. Every action has a button — no typing required.

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

Morning brief 08:00 (Mon–Sat) · Price scan 10:00 / 15:00 / 20:00 (Mon–Fri) ·
Self review 09:00 on the 1st of each month.

They run on Ploy's machine via Windows Task Scheduler — see [PROMPTS.md](PROMPTS.md) to install.
