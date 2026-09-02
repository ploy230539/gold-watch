Produce Ploy's morning gold brief, following the gold-watch skill.

Working folder: D:\Claude_AI\Ploy\Gold

**1. Fetch real prices** — Gold Spot, Thai bar gold (buy and sell), ornament gold sell,
and USD/THB, from Trading Economics, Thai news citing the Gold Traders Association, and
FXStreet.
Never invent a number. Every figure must carry the time it was captured.
If two sources disagree on Spot by more than $20, report a range and say they were
captured at different times.
Any field you genuinely cannot fetch goes in as `null` (`rsi`, `thb_orn`) and the page
renders `—`. Do not substitute a guess.

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
**Recipients** — send to every address listed in `data/recipients.txt`
(one per line; ignore blank lines and lines starting with `#`).
Read that file at send time. Do not hard-code addresses.
Write it in polite, neutral Thai — the voice of a friendly analyst. **Never use มึง/กู**;
other people read this mail.
The "view full dashboard" button/link points to https://ploy230539.github.io/gold-watch/
Mention that the link opens without any login. Close with the disclaimer that this is not
investment advice.

**6. Check the push criteria** from the skill. Send a push only if they are met.
