The Gold Watch price watcher has stopped reporting. Warn Ploy.

Working folder: D:\Claude_AI\Ploy\Gold

You are running because `node gw.mjs health` reported STALE. That means no price scan
has succeeded for over 24 hours, so the quiet inbox does **not** mean gold has been calm —
it means nobody has been looking.

**1. Get the details**

    node gw.mjs health --pretty

Note `last_success_iso`, `consecutive_failures` and `last_error`.

**2. Try once to see whether it is still broken**

    node gw.mjs prices --pretty

If that works now, the outage has ended by itself. Say so in the email rather than
implying the system is still down.

**3. Email the recipients** listed in `data/recipients.txt`
(one per line; ignore blank lines and lines starting with `#`).

Subject: `⚠️ Gold Watch หยุดเฝ้าราคา — ตรวจสอบด่วน`

Build it with the same fixed template as every other Gold Watch email:
write the content to `logs/email-content.json`, run
`node gw.mjs email --in logs/email-content.json --out logs/email.html`,
then send `logs/email.html` as `htmlBody` and `logs/email.txt` as `body`.
Use eyebrow "GOLD WATCH · แจ้งปัญหาระบบ" and leave `rows` empty.

Body, in polite neutral Thai, **no มึง/กู**:
- state plainly that the system has not been able to check prices since <time>,
  and that no alert during that window means nothing about the market
- how long the gap is, and the error if there is a clear one
- whether the retry in step 2 succeeded
- what to check: is the machine awake, is the internet up, are the price sources
  reachable — and that pressing "Live prices" in the Gold Watch panel is the quickest test

Keep it short and calm. This is a maintenance notice, not a market alert.

**4. Also send a push notification** — this one is worth interrupting for, because the
longer it goes unnoticed the longer Ploy is trading blind.

Do not touch `data/state.json`, `data/log.json` or `docs/index.html`.
