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

**3. Send it.**

**The phone push has already gone out.** The scan sends it itself, straight from code,
the moment the threshold trips - see `push_sent` in `logs/scan.json`. **Do not send
another one**, and never use the PushNotification tool (it cannot reach the phone from a
scheduled run). If `push_sent` is `false`, mention `push_error` in chat so it gets noticed.

Your job is the email and the chat note.

**Recipients** — every address listed in `data/recipients.txt`
(one per line; ignore blank lines and lines starting with `#`). Read it at send time.
Do not hard-code addresses.

## Who is reading, and what she wants

Ploy follows the **price going up or down, and what to do about it**. She does not read
tables or charts. So every message leads with a call and a reason, in plain words:

- **ซื้อ** (`buy`) — a good moment to enter
- **ถือ** (`hold`) — keep what she has, nothing to do yet
- **ขาย** (`sell`) — take profit or get out
- **รอ** (`wait`) — stay out for now

Pick the one you would actually act on, and say **why in one or two sentences a person
can read on a phone**, plus **the price that would prove you wrong**. A view that cannot
be wrong is useless. Do not hedge into mush — if it is genuinely unclear, say รอ and why.

No price tables, no charts, no ladders in anything sent to her. Numbers go in sentences
("ทองแท่งลง 300 บาทมาที่ 68,850"), not rows. The dashboard link stays for anyone who wants
the detail — do not reproduce it.

This is a market view, not personal financial advice — keep the one-line disclaimer the
email template adds, and do not claim certainty you do not have.

**Given this move, is the morning call still right?** Read the morning call from the last
row of `data/log.json` (`call`, `call_reason`). Then decide: does this move change it? A
drop through the support level may turn ถือ into ขาย; a bounce off it may turn รอ into ซื้อ.
If it still holds, say so plainly — "ยังถือได้" is a useful answer.

Write the content to `logs/email-content.json`, then run
`node gw.mjs email --in logs/email-content.json`. Fields:

- `eyebrow`   `GOLD MOVE · <date> · <time> น.`
- `headline`  one sentence: how far it moved and in which direction, from the last alert
- `verdict`   `{"call", "reason", "wrong_if"}` — your view **after** this move
- `lead`      two or three sentences: which announcement round, the move in words,
              and whether the morning call changed
- `sections`  at most one, headed **ทำไมขยับ**, with the reason you found
- `dashboard_url` `https://ploy230539.github.io/gold-watch/`

**Leave `rows` out entirely** — no price table.

### Sending — get this exactly right

The command writes two files, each named after the Gmail parameter it belongs in:

| File | Goes in |
|---|---|
| `logs/email.htmlBody.html` | `htmlBody` |
| `logs/email.body.txt` | `body` |

Read both files and pass their full contents to the Gmail send tool in those two
parameters. **Never put the HTML into `body`** — the recipients would see raw markup.
Check yourself before sending: the value going into `body` must start with plain Thai
text, never with `<!doctype html>`.

Polite, neutral Thai in the email — **no มึง/กู** (chat is fine).
End the subject with the `subject_code` from the scan, e.g. `[TH 67850 | XAU 4300]`.

Mention `premium_pct` in the lead when it is outside ±1.2%: above means shops are
charging a fat premium and it is a poor moment to buy; below means Thai prices have not
caught up with world gold yet.

**4. Only after sending**, record the price just alerted on and push it:

    node gw.mjs state set --thb <alerted bar sell> --xau <alerted spot> --note "<why it was sent>"
    node gw.mjs publish -m "state: alert sent <time>"

**If for any reason you did not send, do not touch the state** — the cumulative
threshold would drift.

This job must not touch `payload-latest.json`, `log.json`, or `docs/index.html`.
