Send a gold price alert for Ploy, following the gold-watch skill.

Working folder: D:\Claude_AI\Ploy\Gold

**You are only running because the thresholds were already met.** `tasks/scan.cmd`
fetched live prices and applied the rules in code before invoking you; when nothing
crosses the threshold it exits silently and never starts a model at all. So do not
re-decide whether to alert — decide *what to say*.

**1. Read the decision** in `logs/scan.json`. It contains:
- `alert`, `push`, `channels` — what to send and where
- `reason` — which threshold was crossed
- `ref` — the price the last alert was sent at, and when
- `now`, `thb_move`, `xau_pct` — the current move
- `subject_code` — put this at the end of the email subject, e.g. `[TH 67850 | XAU 4300]`
- `prices` — live figures: `spot`, `thai.bar_sell` / `bar_buy` / `orn_sell`,
  `thai.announced` (announcement round and time), `fx`, `fair_thb`, `premium_pct`
- `targets_hit` — price levels Ploy asked to be told about that have now been reached.
  If this is non-empty, **lead with it**: it is the thing she actually asked for, and
  it matters more than the size of the move. Quote the level and her own note on it.
- `targets_unreadable` — lines in `data/targets.txt` that could not be parsed. Mention
  these at the end of the email so a typo does not sit there silently never firing.

Those numbers are already real and timestamped. Do not re-fetch them.

**2. Find out why** — search the web for what moved the price in the last few hours.
This is the part that needs judgement: one or two concrete reasons from real news, not
speculation. If you cannot find a clear cause, say plainly that the move has no obvious
driver yet.

**3. Send it.** Follow `channels` from the scan:
- `push = false` (moved 150–300 THB) → email + chat, **no phone push**
- `push = true` (≥300 THB, Spot ≥1.5%, big news, or a target hit) → email + push + chat

**Recipients** — every address listed in `data/recipients.txt`
(one per line; ignore blank lines and lines starting with `#`). Read it at send time.
Do not hard-code addresses.

**Build the email from the fixed template — never hand-write the HTML.**
Write the content as JSON to `logs/email-content.json`, then run:

    node gw.mjs email --in logs/email-content.json --out logs/email.html

Content fields:
- `eyebrow`   small gold line above the headline, e.g. "GOLD MOVE · 2 ก.ย. 2569 · 11:08 น."
- `headline`  the one thing the reader should take away, one sentence
- `lead`      optional short paragraph under the header
- `rows`      the price table: `[{"label","value","change","dir"}]` where `dir` is
              `up` / `down` / `flat` and `change` is the bracketed part, e.g. "-1,600 บาท"
- `footnote`  small print under the table — USD/THB and which announcement round the
              Thai price came from, with its time
- `sections`  `[{"heading","paragraphs":[],"bullets":[{"sign":"plus|minus|flat","text"}],
              "rows":[],"note":"..."}]` — `note` renders as the warm highlighted box,
              use it for the "this view is wrong if..." line
- `dashboard_url` "https://ploy230539.github.io/gold-watch/"

Then send with the Gmail tool: `htmlBody` = the contents of `logs/email.html`,
`body` = the contents of `logs/email.txt` (the plain-text alternative it writes alongside).

The template owns every colour, font and spacing decision. Do not restyle it, do not
inline your own HTML, and do not skip it — it exists so every email looks the same as
the last one.

For an alert the shape is: `lead` explains which announcement round this is and how
far it has moved from the price last reported; `rows` carries ทองแท่งขายออก, ทองแท่งรับซื้อ,
Gold Spot and USD/THB; then one section headed **ทำไมขยับ** with the reason you found.

Polite, neutral Thai in the email — **no มึง/กู** (chat and push are fine).
End the subject with the `subject_code` from the scan, e.g. `[TH 67850 | XAU 4300]`.

Mention `premium_pct` when it is outside ±1.2%: above means shops are charging a fat
premium and it is a poor moment to buy; below means Thai prices have not caught up
with world gold yet.

**4. Only after sending**, record the price just alerted on and push it:

    node gw.mjs state set --thb <alerted bar sell> --xau <alerted spot> --note "<why it was sent>"
    node gw.mjs publish -m "state: alert sent <time>"

**If for any reason you did not send, do not touch the state** — the cumulative
threshold would drift.

This job must not touch `payload-latest.json`, `log.json`, or `docs/index.html`.
