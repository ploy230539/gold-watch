Produce Ploy's morning gold brief, following the gold-watch skill.

Working folder: D:\Claude_AI\Ploy\Gold

**Do not send any email.** Email was switched off on 17 Nov 2026 at Ploy's request; the
phone push in step 5 is the only message that goes out. This overrides anything the
gold-watch skill says about emailing the brief.

**1. Get the prices** — run this first; it pulls live figures from free APIs with no
model usage at all:

    node gw.mjs prices

It returns Gold Spot, Thai bar gold buy/sell, ornament gold buy/sell, the announcement
round and time from the Gold Traders Association, USD/THB, plus `fair_thb` and
`premium_pct` already computed for you. Use these numbers.

Only search the web for what those numbers cannot give you: **why** the price moved, the
news calendar, and RSI. If a news source quotes a Spot more than $20 away from the feed,
report a range and note that they were captured at different times - do not silently pick
one. If the price feed fails entirely, fall back to searching, and say so in chat.
Never invent a number. Any field you genuinely cannot get goes in as `null` (`rsi`,
`thb_orn`) and the page renders an em dash.

**2. Write the summary in chat** using the 7-part structure from the skill. Chat tone is
casual Thai; มึง/กู is fine there.

**3. Write the payload, then publish**
Write `D:\Claude_AI\Ploy\Gold\data\payload-latest.json` following the shape in
`payload.example.json`. It must contain: `stamp, lede_h1, lede_p, spot, thb_bar, thb_orn,
fx, levels, rsi, read_text, invalid_text, drivers, calendar, sources, call, log`.
- `call` is one of `buy` / `hold` / `sell` / `wait`
- `call_reason` — **one short Thai line** saying why. Every price push for the rest of
  the day quotes it under "มุมมองเช้านี้", so write it to be read on a lock screen,
  e.g. "ยังยืนเหนือแนวรับ $4,300 ถือต่อ ขายเมื่อหลุด"
- `log` carries `date_display, date_iso, actual_due_iso, actual_due_display`,
  where the due date is 3 business days out

Then run these two commands in the working folder:

    node gw.mjs morning --in data/payload-latest.json
    node gw.mjs publish -m "morning brief <date>"

**Never hand-edit `docs/index.html`.** The script fills the template, computes the
support/resistance ladder, and validates the result. If `morning` errors, read the error
and fix the payload — never skip the validation step.

**4. Track record** — no need to look up historical prices to fill in past outcomes.
`morning` does it automatically from this run's prices (close-to-close; a move under
±0.5% counts as a draw). To cite past results in chat, read `data/log.json`.
**Below 30 rows with an actual result, never quote an accuracy percentage**, and write up
the misses as prominently as the hits.

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

This is a market view, not personal financial advice — do not claim certainty you do
not have.

**5. Push the morning summary to her phone** — this is the message she actually reads.

    node gw.mjs notify --title "<title>" --message "<message>"

- title: `ทองแท่ง <sell price> · <ซื้อ|ถือ|ขาย|รอ>` e.g. `ทองแท่ง 68,850 · ถือ`
- message, 3–4 short lines:
  1. how Thai bar gold moved since yesterday, e.g. `▼300 จากเมื่อวาน · Spot $4,369 (-0.6%)`
  2. the reason for the call, one line
  3. `ผิดถ้า: <the price that proves it wrong>`

Casual Thai is fine in a push. Never use the PushNotification tool — it cannot reach the
phone from a scheduled run.
