// Gold Watch email templates.
//
// The look of these emails used to drift every run, because the model rebuilt the
// layout from scratch each time. It does not any more: the model supplies content,
// this file owns every pixel. Same principle as template.html for the dashboard.
//
// Table-based layout with fully inline styles, because Gmail strips <style> blocks
// in several of its clients.

const INK = "#1b1812";
const MUTED = "#6b6255";
const GOLD = "#c9a227";
const GOLD_DEEP = "#8a6a14";
const DARK = "#1c1a14";
const PAPER = "#f1efe7";
const CARD = "#ffffff";
const LINE = "#e6e2d6";
const RED = "#a8342b";
const GREEN = "#1a7048";

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans Thai',Roboto,Helvetica,Arial,sans-serif";

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Colour for a change value: negative reads red, positive green, flat muted. */
function dirColor(dir) {
  if (dir === "up") return GREEN;
  if (dir === "down") return RED;
  return MUTED;
}

function priceRow(r, isLast) {
  const border = isLast ? "" : `border-bottom:1px solid ${LINE};`;
  const change = r.change
    ? `<span style="color:${dirColor(r.dir)};font-weight:600;white-space:nowrap;"> (${esc(r.change)})</span>`
    : "";
  return `
      <tr>
        <td style="padding:13px 0;${border}font:400 15px ${FONT};color:${MUTED};vertical-align:top;">
          ${esc(r.label)}
        </td>
        <td style="padding:13px 0;${border}font:700 17px ${FONT};color:${INK};text-align:right;vertical-align:top;">
          ${esc(r.value)}${change}
        </td>
      </tr>`;
}

function priceTable(rows) {
  if (!rows || !rows.length) return "";
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;border-collapse:collapse;">
    ${rows.map((r, i) => priceRow(r, i === rows.length - 1)).join("")}
  </table>`;
}

function bulletList(items) {
  return items.map((b) => {
    const mark = b.sign === "plus" ? "+" : b.sign === "minus" ? "−" : "·";
    const colour = b.sign === "plus" ? GREEN : b.sign === "minus" ? RED : MUTED;
    return `
      <tr>
        <td width="22" style="padding:5px 0 5px 0;font:700 14px ${FONT};color:${colour};vertical-align:top;">${mark}</td>
        <td style="padding:5px 0;font:400 15px ${FONT};color:${INK};line-height:1.55;">${esc(b.text)}</td>
      </tr>`;
  }).join("");
}

function section(sec) {
  const parts = [];
  if (sec.heading) {
    parts.push(`<div style="font:700 15px ${FONT};color:${INK};margin:0 0 10px;">${esc(sec.heading)}</div>`);
  }
  for (const p of sec.paragraphs || []) {
    parts.push(`<p style="margin:0 0 10px;font:400 15px ${FONT};color:${INK};line-height:1.62;">${esc(p)}</p>`);
  }
  if (sec.bullets && sec.bullets.length) {
    parts.push(`<table role="presentation" cellpadding="0" cellspacing="0" width="100%"
      style="width:100%;border-collapse:collapse;">${bulletList(sec.bullets)}</table>`);
  }
  if (sec.rows && sec.rows.length) parts.push(priceTable(sec.rows));
  if (sec.note) {
    parts.push(`<div style="margin-top:12px;padding:10px 13px;background:#f7ecd4;border-radius:8px;
      font:400 13.5px ${FONT};color:${GOLD_DEEP};line-height:1.55;">${esc(sec.note)}</div>`);
  }
  return `
  <tr><td style="padding:20px 26px 4px;">
    ${parts.join("\n    ")}
  </td></tr>`;
}

// The verdict is the point of the email: what to do, why, and how you would know it
// was wrong. It sits straight under the header, above everything else.
const VERDICT = {
  buy:  { label: "ซื้อ", bg: "#e4f2ea", fg: "#1a7048" },
  hold: { label: "ถือ",  bg: "#f1e4c2", fg: "#5c4213" },
  sell: { label: "ขาย", bg: "#fbe9e6", fg: "#a8342b" },
  wait: { label: "รอ",   bg: "#f7ecd4", fg: "#8a5a12" },
};

function verdictBlock(v) {
  if (!v || !VERDICT[v.call]) return "";
  const c = VERDICT[v.call];
  const wrong = v.wrong_if
    ? `<div style="margin-top:12px;font:400 14px ${FONT};color:${MUTED};line-height:1.55;">
         <b style="color:${INK};">มุมมองนี้ผิดถ้า</b> ${esc(v.wrong_if)}</div>`
    : "";
  return `
  <tr><td style="padding:22px 26px 4px;">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="background:${c.bg};border-radius:10px;padding:8px 18px;
                 font:800 22px ${FONT};color:${c.fg};">${c.label}</td>
      <td style="padding-left:14px;font:600 13px ${FONT};color:${MUTED};">มุมมองตอนนี้</td>
    </tr></table>
    <p style="margin:14px 0 0;font:400 16px ${FONT};color:${INK};line-height:1.62;">${esc(v.reason || "")}</p>
    ${wrong}
  </td></tr>`;
}

function ctaButton(url, label) {
  return `
  <tr><td style="padding:22px 26px 6px;">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="background:${DARK};border-radius:9px;">
        <a href="${esc(url)}" style="display:inline-block;padding:12px 22px;font:600 15px ${FONT};
           color:#f3d999;text-decoration:none;">${esc(label)} &rarr;</a>
      </td>
    </tr></table>
    <div style="margin-top:9px;font:400 13px ${FONT};color:${MUTED};">
      ลิงก์เปิดดูได้ทันที ไม่ต้องล็อกอินบัญชีใดๆ
    </div>
  </td></tr>`;
}

/**
 * @param {object} d
 *   eyebrow      small gold line above the headline
 *   headline     the one thing the reader should take away
 *   verdict      {call: buy|hold|sell|wait, reason, wrong_if} - leads the email
 *   lead         optional paragraph under the header, before the price table
 *   rows         price table rows [{label, value, change, dir}]
 *   footnote     small print under the price table
 *   sections     [{heading, paragraphs, bullets, rows, note}]
 *   dashboard_url, cta_label
 *   disclaimer
 */
export function renderEmail(d) {
  const rows = priceTable(d.rows);
  const sections = (d.sections || []).map(section).join("");

  return `<!doctype html>
<html lang="th"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(d.headline || "Gold Watch")}</title></head>
<body style="margin:0;padding:0;background:${PAPER};word-wrap:break-word;overflow-wrap:anywhere;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${PAPER};padding:18px 12px;">
<tr><td align="center">

<!-- Fluid, capped at 600px. A fixed width="600" attribute makes the table cell grow to
     fit it, so on a phone the card ran off the right edge and clipped every line. -->
<table role="presentation" cellpadding="0" cellspacing="0" width="100%"
  style="width:100%;max-width:600px;background:${CARD};border-radius:14px;overflow:hidden;
         border:1px solid ${LINE};table-layout:fixed;">

  <tr><td style="background:${DARK};padding:26px;">
    <div style="font:700 12.5px ${FONT};letter-spacing:0.08em;color:${GOLD};margin-bottom:12px;">
      ${esc(d.eyebrow || "")}
    </div>
    <div style="font:700 25px ${FONT};color:#ffffff;line-height:1.32;">
      ${esc(d.headline || "")}
    </div>
  </td></tr>

  ${verdictBlock(d.verdict)}

  ${d.lead ? `<tr><td style="padding:20px 26px 0;">
    <p style="margin:0;font:400 15px ${FONT};color:${INK};line-height:1.62;">${esc(d.lead)}</p>
  </td></tr>` : ""}

  ${rows ? `<tr><td style="padding:16px 26px 0;">${rows}</td></tr>` : ""}

  ${d.footnote ? `<tr><td style="padding:12px 26px 0;">
    <div style="font:400 13px ${FONT};color:${MUTED};line-height:1.6;">${esc(d.footnote)}</div>
  </td></tr>` : ""}

  ${sections}

  ${d.dashboard_url ? ctaButton(d.dashboard_url, d.cta_label || "ดู dashboard เต็ม") : ""}

  <tr><td style="padding:20px 26px 26px;">
    <div style="border-top:1px solid ${LINE};padding-top:14px;
      font:400 12.5px ${FONT};color:${MUTED};line-height:1.6;">
      ${esc(d.disclaimer || "ข้อมูลนี้เป็นข้อมูลประกอบการตัดสินใจเท่านั้น ไม่ใช่คำแนะนำการลงทุน โปรดใช้วิจารณญาณของท่านเอง")}
    </div>
  </td></tr>

</table>

<div style="font:400 12px ${FONT};color:${MUTED};margin-top:14px;">Gold Watch</div>

</td></tr></table>
</body></html>`;
}

/** Plain-text alternative, so the mail is still readable where HTML is off. */
export function renderPlain(d) {
  const L = [];
  if (d.eyebrow) L.push(d.eyebrow);
  if (d.headline) L.push("", d.headline);
  if (d.verdict && VERDICT[d.verdict.call]) {
    L.push("", `มุมมองตอนนี้: ${VERDICT[d.verdict.call].label}`);
    if (d.verdict.reason) L.push(d.verdict.reason);
    if (d.verdict.wrong_if) L.push(`มุมมองนี้ผิดถ้า ${d.verdict.wrong_if}`);
  }
  if (d.lead) L.push("", d.lead);
  if (d.rows && d.rows.length) {
    L.push("");
    for (const r of d.rows) L.push(`${r.label}: ${r.value}${r.change ? ` (${r.change})` : ""}`);
  }
  if (d.footnote) L.push("", d.footnote);
  for (const s of d.sections || []) {
    L.push("");
    if (s.heading) L.push(s.heading);
    for (const p of s.paragraphs || []) L.push(p);
    for (const b of s.bullets || []) L.push(`- ${b.text}`);
    for (const r of s.rows || []) L.push(`${r.label}: ${r.value}${r.change ? ` (${r.change})` : ""}`);
    if (s.note) L.push(s.note);
  }
  if (d.dashboard_url) L.push("", `ดู dashboard เต็ม: ${d.dashboard_url}`);
  L.push("", d.disclaimer || "ข้อมูลนี้เป็นข้อมูลประกอบการตัดสินใจเท่านั้น ไม่ใช่คำแนะนำการลงทุน");
  return L.join("\n");
}
