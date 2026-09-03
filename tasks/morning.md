Produce Ploy's morning gold brief, following the gold-watch skill.

Working folder: D:\Claude_AI\Ploy\Gold

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
- `call` is one of `buy` / `hold` / `wait`
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
±0.5% counts as a draw). To cite past results in chat or email, read `data/log.json`.
**Below 30 rows with an actual result, never quote an accuracy percentage**, and write up
the misses as prominently as the hits.

**5. Send the morning email.**
**Recipients** — every address listed in `data/recipients.txt`
(one per line; ignore blank lines and lines starting with `#`). Read it at send time.
Do not hard-code addresses.

**Build the email from the fixed template — never hand-write the HTML.**
Write the content as JSON to `logs/email-content.json`, then run:

    node gw.mjs email --in logs/email-content.json --out logs/email.html

Content fields:
- `eyebrow`   small gold line above the headline, e.g. "สรุปทองเช้า · 2 กันยายน 2569"
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

Write the words in polite, neutral Thai — the voice of a friendly analyst.
**Never use มึง/กู**; other people read this mail. Mention that the dashboard link
opens without any login.

Sections to include, in this order: **ทำไมขยับ** (bullets, real news only),
**ตัวเลขที่ต้องจ้อง** (support/resistance rows), **ข่าวที่ต้องระวัง** (calendar),
**อ่านเกม** (buy / hold / wait with the reason, and the "wrong if..." line as `note`).

**6. Check the push criteria** from the skill. Send a push only if they are met.
