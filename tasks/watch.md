Run a gold price scan for Ploy, following the gold-watch skill.

Working folder: D:\Claude_AI\Ploy\Gold

**1. Read the last price an alert was sent for**

    node gw.mjs state get

It returns `thb_sell` (Thai bar gold, sell) and `xau` (Spot, rounded) — that is the
reference point.
If the state file is broken, fall back to reading the code off the email subject line as
before (Gmail search: `in:sent subject:"ทองขยับ" newer_than:2d`, format
`[TH <bar sell> | XAU <spot>]`) and say in chat that the state file has a problem.

**2. Fetch the current prices** from the web. Never guess.

**3. Let the script apply the thresholds**

    node gw.mjs check --thb <current bar sell> --xau <current spot>

Add `--news` if there is genuinely market-moving news — a human judges that, not the script.

The script returns `alert`, `push`, and `channels`. Follow them:
- `alert = false` → **total silence. Send nothing, and write nothing in chat either.**
  Unnecessary alerts are what make Ploy stop reading the necessary ones.
- `alert = true`, `push = false` (moved 150–300 THB) → email + chat, **no phone push**
- `alert = true`, `push = true` (≥300 THB, Spot ≥1.5%, or big news) → email + push + chat

**4. If sending** — send the email.
**Recipients** — send to every address listed in `data/recipients.txt`
(one per line; ignore blank lines and lines starting with `#`).
Read that file at send time. Do not hard-code addresses.
Polite, neutral Thai. **No มึง/กู** in email (chat and push are fine).
End the subject line with the `subject_code` the script returned, e.g. `[TH 71500 | XAU 4620]`.
Any dashboard link in email, chat, or push uses https://ploy230539.github.io/gold-watch/

**5. Only after sending**, record the price just alerted on and push it:

    node gw.mjs state set --thb <alerted> --xau <alerted> --note "<why it was sent>"
    node gw.mjs publish -m "state: alert sent <time>"

**If nothing was sent, do not touch the state** — the cumulative threshold would drift.

This job must not touch `payload-latest.json`, `log.json`, or `docs/index.html`.
