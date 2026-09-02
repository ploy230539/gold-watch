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

Those numbers are already real and timestamped. Do not re-fetch them.

**2. Find out why** — search the web for what moved the price in the last few hours.
This is the part that needs judgement: one or two concrete reasons from real news, not
speculation. If you cannot find a clear cause, say plainly that the move has no obvious
driver yet.

**3. Send it.** Follow `channels` from the scan:
- `push = false` (moved 150–300 THB) → email + chat, **no phone push**
- `push = true` (≥300 THB, Spot ≥1.5%, or big news) → email + push + chat

**Recipients** — every address listed in `data/recipients.txt`
(one per line; ignore blank lines and lines starting with `#`). Read it at send time.
Do not hard-code addresses.

Email in polite, neutral Thai — the voice of a friendly analyst. **No มึง/กู** in email
(chat and push are fine). End the subject with the `subject_code` from the scan.
Any dashboard link uses https://ploy230539.github.io/gold-watch/

Mention `premium_pct` when it is outside ±1.2%: above means shops are charging a fat
premium and it is a poor moment to buy; below means Thai prices have not caught up with
world gold yet.

**4. Only after sending**, record the price just alerted on and push it:

    node gw.mjs state set --thb <alerted bar sell> --xau <alerted spot> --note "<why it was sent>"
    node gw.mjs publish -m "state: alert sent <time>"

**If for any reason you did not send, do not touch the state** — the cumulative
threshold would drift.

This job must not touch `payload-latest.json`, `log.json`, or `docs/index.html`.
