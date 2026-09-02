#!/usr/bin/env node
// Gold Watch — build / state / publish
// No external dependencies. Requires node >= 18.
//
//   node gw.mjs build   --in payload.json          fill template -> docs/index.html (log untouched)
//   node gw.mjs morning --in payload.json          fill due results + append today's row + build
//   node gw.mjs publish [-m "msg"]                 commit + push to GitHub Pages
//   node gw.mjs check   --thb N --xau N [--news]   compare against last alerted price -> alert?
//     add --pretty to check / scan / prices / log for readable output instead of JSON
//   node gw.mjs prices [--pretty]                  fetch live prices from free APIs (no model)
//   node gw.mjs scan    [--news]                   prices + threshold check; exit 10 = alert needed
//   node gw.mjs state get|set --thb N --xau N [--note "..."]
//   node gw.mjs log                                print the track-record log as JSON

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const P = {
  template: path.join(ROOT, "template.html"),
  log: path.join(ROOT, "data", "log.json"),
  state: path.join(ROOT, "data", "state.json"),
  out: path.join(ROOT, "docs", "index.html"),
};

// ── System constants (do not change casually — see README) ────────────────
const GRAMS_PER_OZ = 31.1035;
const GRAMS_PER_BAHT = 15.244;
const THAI_PURITY = 0.965;

/** Fair Thai gold price (THB per baht-weight) */
export function fairThb(spot, usdthb) {
  return (spot / GRAMS_PER_OZ) * GRAMS_PER_BAHT * THAI_PURITY * usdthb;
}

// Price-watch alert thresholds
const ALERT_THB = 150;   // Thai gold moved >= 150 THB from the last alerted price (cumulative)
const ALERT_XAU_PCT = 1.5;
const PUSH_THB = 300;    // below this, email only - no phone push
const PUSH_XAU_PCT = 1.5;
const MIN_ROWS_FOR_STATS = 30; // below this, never quote an accuracy percentage

// ── utils ──────────────────────────────────────────────────────────────────
const readJson = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const writeJson = (f, o) => fs.writeFileSync(f, JSON.stringify(o, null, 2) + "\n");
const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const num = (n, d = 0) =>
  Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const usd = (n, d = 0) => "$" + num(n, d);
const baht = (n) => "฿" + num(Math.round(n));
const pct = (n, d = 2) => (n >= 0 ? "+" : "") + Number(n).toFixed(d) + "%";
const signed = (n) => (n >= 0 ? "+" : "") + num(Math.round(n));
const deltaClass = (n) => (n > 0 ? "up" : n < 0 ? "down" : "flat");
const tileClass = (n) => (n > 0 ? "is-up" : n < 0 ? "is-down" : "");

function args(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) o[k] = true;
      else { o[k] = next; i++; }
    } else o._.push(a);
  }
  return o;
}

function die(msg) {
  console.error("gw: " + msg);
  process.exit(1);
}

// ── ladder ─────────────────────────────────────────────────────────────────
// bottom% = (price − range low) ÷ (range high − range low) × 100
// Pad both ends by 8% of the span so markers never sit flush against the rail.
function ladder({ resistance_usd, support_usd_low, support_usd_high, now_usd }) {
  const vals = [resistance_usd, support_usd_low, support_usd_high, now_usd];
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (hi === lo) { hi = lo + 1; }
  const pad = (hi - lo) * 0.08;
  lo -= pad; hi += pad;
  const at = (v) => ((v - lo) / (hi - lo)) * 100;
  const zLo = at(support_usd_low);
  const zHi = at(support_usd_high);
  return {
    RES_BOTTOM: at(resistance_usd).toFixed(1),
    NOW_BOTTOM: at(now_usd).toFixed(1),
    SUP_BOTTOM: zLo.toFixed(1),
    ZONE_BOTTOM: zLo.toFixed(1),
    ZONE_HEIGHT: Math.max(zHi - zLo, 1.5).toFixed(1),
  };
}

// ── HTML fragments generated from the payload ─────────────────────────────
const driversHtml = (list) =>
  list.map((d) => {
    const sign = d.sign === "plus" ? "plus" : d.sign === "minus" ? "minus" : "";
    const mark = d.sign === "plus" ? "+" : d.sign === "minus" ? "−" : "·";
    return `<div class="sig ${sign}"><span class="mk">${mark}</span><span>${esc(d.text)}</span></div>`;
  }).join("\n        ");

const calendarHtml = (list) =>
  list.map((e) =>
    `<div class="ev${e.big ? " big" : ""}"><div class="when">${esc(e.when)}</div>` +
    `<div class="what">${e.big ? `<b>${esc(e.what)}</b>` : esc(e.what)}` +
    `${e.note ? ` — ${esc(e.note)}` : ""}</div></div>`
  ).join("\n        ");

const sourcesHtml = (list) =>
  list.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`)
    .join(" · ");

const CALL_LABEL = { buy: "ซื้อ", hold: "ถือ", wait: "รอ" };

function logRowsHtml(rows) {
  return [...rows].reverse().map((r) => {
    const call = CALL_LABEL[r.call] || esc(r.call);
    const sup = r.support_usd_low === r.support_usd_high
      ? usd(r.support_usd_low)
      : `${usd(r.support_usd_low)}–${usd(r.support_usd_high)}`;
    const levels =
      `<div class="lv">รับ ${sup} · ต้าน ${usd(r.resistance_usd)}</div>` +
      (r.invalid_note ? `<div class="iv">${esc(r.invalid_note)}</div>` : "");
    const actual = r.actual_result == null
      ? `<td class="pending">รอผล ${esc(r.actual_due_display || "")}</td>`
      : `<td>${esc(r.actual_result)}</td>`;
    return `<tr>` +
      `<td class="d">${esc(r.date_display)}</td>` +
      `<td class="n">${usd(r.spot, 2)}</td>` +
      `<td class="n">${baht(r.thb_sell)}</td>` +
      `<td><span class="call ${esc(r.call)}">${call}</span></td>` +
      `<td>${levels}</td>` +
      actual +
      `</tr>`;
  }).join("\n          ");
}

function logNote(rows) {
  const filled = rows.filter((r) => r.actual_result != null).length;
  if (filled < MIN_ROWS_FOR_STATS) {
    return `เก็บข้อมูลแล้ว ${rows.length} แถว · มีผลจริงแล้ว ${filled} แถว — ` +
      `ยังไม่ถึง ${MIN_ROWS_FOR_STATS} แถว จึงยังไม่สรุปเป็น % ความแม่น ` +
      `และช่วงที่เก็บยังไม่ครบทั้งขาขึ้นและขาลง สถิติจากตลาดเทรนด์เดียวใช้ตัดสินอะไรไม่ได้`;
  }
  const right = rows.filter((r) => /^✓/.test(String(r.actual_result))).length;
  const wrong = rows.filter((r) => /^✗/.test(String(r.actual_result))).length;
  return `มีผลจริงแล้ว ${filled} แถว — ตรง ${right} · พลาด ${wrong} · ที่เหลือเสมอ ` +
    `(จากทั้งหมด ${filled} ครั้ง) สถิติในอดีตไม่ได้การันตีอนาคต และต้องดูด้วยว่า ` +
    `ช่วงที่เก็บครอบคลุมทั้งขาขึ้นและขาลงหรือไม่`;
}

function rsiRead(rsi) {
  if (rsi >= 70) return "เข้าเขตซื้อมากเกินไป (overbought) ระวังย่อ";
  if (rsi >= 55) return "โมเมนตัมยังเอียงไปทางขึ้น";
  if (rsi > 45) return "กลางๆ ไม่ให้สัญญาณชัด";
  if (rsi > 30) return "โมเมนตัมเอียงไปทางลง";
  return "เข้าเขตขายมากเกินไป (oversold) มีโอกาสเด้ง";
}

// ── render ─────────────────────────────────────────────────────────────────
// Must carry a real value - null is rejected
const REQUIRED = [
  "stamp", "lede_h1", "lede_p", "spot", "thb_bar", "thb_orn", "fx",
  "levels", "read_text", "invalid_text", "drivers", "calendar", "sources",
];
// Key must be present but may be null (means "unavailable this run", not "forgotten")
const NULLABLE = ["rsi"];

function render(payload, rows) {
  const missing = REQUIRED.filter((k) => payload[k] === undefined || payload[k] === null);
  if (missing.length) die("payload is missing required fields: " + missing.join(", "));
  const absent = NULLABLE.filter((k) => !(k in payload));
  if (absent.length) die("payload must contain these keys (null allowed if unavailable): " + absent.join(", "));

  const { spot, thb_bar, thb_orn, fx, levels } = payload;
  for (const [obj, keys, name] of [
    [spot, ["value", "delta_pct", "sub"], "spot"],
    [thb_bar, ["sell", "delta", "sub"], "thb_bar"],
    [fx, ["value", "delta_pct", "sub"], "fx"],
    [levels, ["resistance_usd", "resistance_thb", "support_usd_low", "support_usd_high", "support_thb"], "levels"],
  ]) {
    const miss = keys.filter((k) => obj[k] === undefined || obj[k] === null);
    if (miss.length) die(`payload.${name} is missing: ${miss.join(", ")}`);
  }

  const hasRsi = payload.rsi != null && Number.isFinite(Number(payload.rsi));

  const supUsd = levels.support_usd_low === levels.support_usd_high
    ? usd(levels.support_usd_low)
    : `${usd(levels.support_usd_low)}–${usd(levels.support_usd_high)}`;

  const map = {
    STAMP: esc(payload.stamp),
    LEDE_H1: esc(payload.lede_h1),
    LEDE_P: esc(payload.lede_p),

    TILE1_CLASS: tileClass(spot.delta_pct),
    SPOT_VAL: usd(spot.value, 2),
    SPOT_DELTA: pct(spot.delta_pct),
    SPOT_DELTA_CLASS: deltaClass(spot.delta_pct),
    SPOT_SUB: esc(spot.sub),

    TILE2_CLASS: tileClass(thb_bar.delta),
    THB_BAR_VAL: baht(thb_bar.sell),
    THB_BAR_DELTA: signed(thb_bar.delta),
    THB_BAR_DELTA_CLASS: deltaClass(thb_bar.delta),
    THB_BAR_SUB: esc(thb_bar.sub),

    // Ornament gold is supplementary: render — rather than guess when unavailable
    TILE3_CLASS: thb_orn.sell == null ? "" : tileClass(thb_orn.delta),
    THB_ORN_VAL: thb_orn.sell == null ? "—" : baht(thb_orn.sell),
    THB_ORN_DELTA: thb_orn.delta == null ? "ไม่มีข้อมูลรอบนี้" : signed(thb_orn.delta),
    THB_ORN_DELTA_CLASS: thb_orn.delta == null ? "flat" : deltaClass(thb_orn.delta),

    TILE4_CLASS: tileClass(fx.delta_pct),
    FX_VAL: num(fx.value, 2),
    FX_DELTA: pct(fx.delta_pct),
    FX_DELTA_CLASS: deltaClass(fx.delta_pct),
    FX_SUB: esc(fx.sub),

    RES_USD: usd(levels.resistance_usd),
    RES_THB: baht(levels.resistance_thb),
    SUP_USD: supUsd,
    SUP_THB: baht(levels.support_thb),
    NOW_USD: usd(spot.value, 2),
    ...ladder({ ...levels, now_usd: spot.value }),

    RSI: hasRsi ? Number(payload.rsi).toFixed(0) : "—",
    RSI_READ: esc(payload.rsi_read ||
      (hasRsi ? rsiRead(Number(payload.rsi)) : "รอบนี้ยังไม่ได้ดึงค่า RSI")),

    READ_TEXT: esc(payload.read_text),
    INVALID_TEXT: esc(payload.invalid_text),

    DRIVERS_HTML: driversHtml(payload.drivers),
    CALENDAR_HTML: calendarHtml(payload.calendar),
    SOURCES_HTML: sourcesHtml(payload.sources),

    CALC_SPOT: Number(spot.value).toFixed(2),
    CALC_FX: Number(fx.value).toFixed(2),
    CALC_ACTUAL: String(Math.round(thb_bar.sell)),

    LOG_ROWS_HTML: logRowsHtml(rows),
    LOG_NOTE: esc(logNote(rows)),
  };

  let html = fs.readFileSync(P.template, "utf8");
  html = html.replace(/\{\{([A-Z0-9_]+)\}\}/g, (m, key) => {
    if (!(key in map)) die(`template has a placeholder this script does not know: ${m}`);
    return map[key];
  });

  const left = html.match(/\{\{[A-Za-z0-9_]+\}\}/g);
  if (left) die("placeholders still unfilled after render: " + [...new Set(left)].join(", "));

  return html;
}

// ── Track record: auto-fill actual_result for rows that came due ──────────
// Close-to-close measurement: today's price vs the price recorded on that row.
function fillActuals(rows, today) {
  const { date_iso, spot, thb_sell } = today;
  const filled = [];
  for (const r of rows) {
    if (r.actual_result != null) continue;
    if (!r.actual_due_iso || r.actual_due_iso > date_iso) continue;
    if (r.date_iso === date_iso) continue;

    const dThb = thb_sell - r.thb_sell;
    const pThb = (dThb / r.thb_sell) * 100;
    const pSpot = ((spot - r.spot) / r.spot) * 100;

    // Within ±0.5% is a draw - below the shop bid/ask spread, so not tradable
    const up = pThb >= 0.5, down = pThb <= -0.5;
    let verdict;
    if (r.call === "buy") verdict = up ? "ถูก" : down ? "ผิด" : "เสมอ";
    else if (r.call === "wait") verdict = down ? "ถูก" : up ? "ผิด" : "เสมอ";
    else verdict = down ? "ผิด" : up ? "ถูก" : "เสมอ";

    const mark = verdict === "ถูก" ? "✓" : verdict === "ผิด" ? "✗" : "=";
    const why = {
      buy: { ถูก: "ซื้อแล้วราคาขึ้นจริง", ผิด: "ซื้อแล้วราคาลง", เสมอ: "ราคาแทบไม่ขยับ ไม่คุ้มส่วนต่างซื้อ-ขาย" },
      wait: { ถูก: "รอแล้วราคาลงจริง ได้ของถูกลง", ผิด: "รอแล้วราคาขึ้น พลาดจังหวะ", เสมอ: "ราคาแทบไม่ขยับ รอแล้วไม่เสียอะไร" },
      hold: { ถูก: "ถือแล้วราคาขึ้น", ผิด: "ถือแล้วราคาลง", เสมอ: "ราคาแทบไม่ขยับ" },
    }[r.call]?.[verdict] || "";

    r.actual_result =
      `${mark} ${verdict} — ${baht(r.thb_sell)} → ${baht(thb_sell)} ` +
      `(${signed(dThb)}, ${pct(pThb)}) · Spot ${pct(pSpot)} — ${why} ` +
      `[วัดวันที่ ${today.date_display}]`;
    filled.push(r.date_display);
  }
  return filled;
}

// ── State: the price-watch memory ─────────────────────────────────────────
function loadState() {
  if (!fs.existsSync(P.state)) return { last_alert: null, history: [] };
  return readJson(P.state);
}
const subjectCode = (thb, xau) => `[TH ${Math.round(thb)} | XAU ${Math.round(xau)}]`;

function decide(thb, xau, news) {
  const st = loadState();
  const ref = st.last_alert;

  if (!ref) {
    return {
      alert: true, push: news, channels: ["email", "chat"],
      reason: "No alert sent yet - establishing the first reference point",
      ref: null, now: { thb_sell: thb, xau },
      thb_move: null, xau_pct: null,
      subject_code: subjectCode(thb, xau),
    };
  }

  const thbMove = thb - ref.thb_sell;
  const xauPct = ((xau - ref.xau) / ref.xau) * 100;
  const hitThb = Math.abs(thbMove) >= ALERT_THB;
  const hitXau = Math.abs(xauPct) >= ALERT_XAU_PCT;
  const alert = hitThb || hitXau || news;
  const push = Math.abs(thbMove) >= PUSH_THB || Math.abs(xauPct) >= PUSH_XAU_PCT || news;

  const reasons = [];
  if (hitThb) reasons.push(`Thai gold moved ${signed(thbMove)} THB from the last alert (threshold ${ALERT_THB})`);
  if (hitXau) reasons.push(`Spot moved ${pct(xauPct)} from the last alert (threshold ${ALERT_XAU_PCT}%)`);
  if (news) reasons.push("Market-moving news flagged by the operator");
  if (!alert) reasons.push(`Below threshold - Thai gold ${signed(thbMove)} THB / Spot ${pct(xauPct)} -> stay silent, send nothing`);

  return {
    alert, push,
    channels: alert ? (push ? ["email", "push", "chat"] : ["email", "chat"]) : [],
    reason: reasons.join(" · "),
    ref: { thb_sell: ref.thb_sell, xau: ref.xau, ts_iso: ref.ts_iso },
    now: { thb_sell: thb, xau },
    thb_move: Math.round(thbMove),
    xau_pct: Number(xauPct.toFixed(3)),
    subject_code: subjectCode(thb, xau),
  };
}

function prettyDecision(d, title) {
  const pad = (l) => l.padEnd(20, " ");
  const money = (n, dp = 0) => num(n, dp).padStart(10, " ");
  const when = new Date().toLocaleString("en-GB", { hour12: false }).replace(",", "");
  const L = [];
  L.push("  " + title + " ".repeat(Math.max(1, 39 - title.length)) + when);
  L.push("  " + "=".repeat(58));
  L.push("");
  if (d.ref) {
    const rt = new Date(d.ref.ts_iso).toLocaleString("en-GB", { hour12: false }).replace(",", "");
    L.push("  " + pad("Last alerted at") + "THB " + money(d.ref.thb_sell) + "     XAU " + num(d.ref.xau, 2));
    L.push("  " + " ".repeat(20) + "    " + " ".repeat(10) + "     " + rt);
  } else {
    L.push("  " + pad("Last alerted at") + "    (never - first reference point)");
  }
  L.push("  " + pad("Now") + "THB " + money(d.now.thb_sell) + "     XAU " + num(d.now.xau, 2));
  L.push("");
  if (d.thb_move !== null && d.thb_move !== undefined) {
    L.push("  " + pad("Moved") + "THB " + signed(d.thb_move).padStart(10, " ") +
           "     Spot " + pct(d.xau_pct));
  }
  L.push("");
  const verdict = !d.alert ? "SILENT - nothing sent, no model used"
    : d.push ? "ALERT - email + phone push + chat"
    : "ALERT - email + chat (no phone push)";
  L.push("  " + pad("Decision") + "    " + verdict);
  L.push("  " + " ".repeat(20) + "    " + d.reason);
  L.push("");
  L.push("  " + pad("Subject code") + "    " + d.subject_code);
  return L.join("\n");
}

function cmdCheck(a) {
  const thb = Number(a.thb), xau = Number(a.xau);
  if (!Number.isFinite(thb) || !Number.isFinite(xau)) die("check requires --thb and --xau");
  const d = decide(thb, xau, !!a.news);
  console.log(a.pretty ? prettyDecision(d, "ALERT CHECK") : JSON.stringify(d, null, 2));
}

function cmdState(a) {
  const sub = a._[1];
  if (sub === "get" || !sub) {
    const st = loadState();
    return console.log(JSON.stringify(st.last_alert, null, 2));
  }
  if (sub !== "set") die("usage: state get | state set --thb N --xau N");
  const thb = Number(a.thb), xau = Number(a.xau);
  if (!Number.isFinite(thb) || !Number.isFinite(xau)) die("state set requires --thb and --xau");
  const st = loadState();
  const entry = {
    ts_iso: new Date().toISOString(),
    thb_sell: Math.round(thb),
    xau: Number(xau),
    note: a.note ? String(a.note) : "",
  };
  st.last_alert = entry;
  st.history = [...(st.history || []), entry].slice(-100);
  writeJson(P.state, st);
  console.log(JSON.stringify({ ok: true, last_alert: entry, subject_code: subjectCode(thb, xau) }, null, 2));
}

// ── Live prices, fetched without a model ─────────────────────────────────
// Three free sources, no API keys. If any one fails the whole fetch fails loudly
// rather than reporting a partial picture that could trigger a wrong alert.
const SOURCES = {
  spot: "https://api.gold-api.com/price/XAU",
  thai: "https://api.chnwt.dev/thai-gold-api/latest",
  fx: "https://api.frankfurter.dev/v1/latest?base=USD&symbols=THB",
};

async function getJson(url, ms = 15000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { "user-agent": "gold-watch" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

const toNum = (v) => Number(String(v).replace(/,/g, ""));

async function fetchPrices() {
  const errors = [];
  const [spotRes, thaiRes, fxRes] = await Promise.all(
    ["spot", "thai", "fx"].map((k) =>
      getJson(SOURCES[k]).catch((e) => { errors.push(`${k}: ${e.message}`); return null; })
    )
  );
  if (errors.length) {
    const err = new Error("could not fetch prices — " + errors.join(" · "));
    err.partial = true;
    throw err;
  }

  const spot = Number(spotRes.price);
  const fx = Number(fxRes.rates.THB);
  const t = thaiRes.response.price;
  const barSell = toNum(t.gold_bar.sell);
  const barBuy = toNum(t.gold_bar.buy);
  const ornSell = toNum(t.gold.sell);
  const ornBuy = toNum(t.gold.buy);

  for (const [name, v] of [["spot", spot], ["fx", fx], ["bar sell", barSell]]) {
    if (!Number.isFinite(v) || v <= 0) throw new Error(`bad ${name} value from source: ${v}`);
  }

  const fair = fairThb(spot, fx);
  return {
    fetched_at_iso: new Date().toISOString(),
    spot: { value: spot, source: SOURCES.spot, as_of: spotRes.updatedAt || null },
    thai: {
      bar_sell: barSell, bar_buy: barBuy, orn_sell: ornSell, orn_buy: ornBuy,
      announced: `${thaiRes.response.update_date} ${thaiRes.response.update_time}`,
      source: SOURCES.thai,
    },
    fx: { value: fx, as_of: fxRes.date, source: SOURCES.fx },
    fair_thb: Math.round(fair),
    premium_pct: Number((((barSell - fair) / fair) * 100).toFixed(2)),
  };
}

// Human-readable rendering. Deliberately ASCII-only: the control panel shows this in a
// monospace font that has no Thai glyphs, so the association's Thai timestamp is parsed
// into digits rather than passed through.
function prettyPrices(p) {
  const pad = (label) => label.padEnd(20, " ");
  const money = (n, d = 0) => num(n, d).padStart(10, " ");
  const t = p.thai;

  const m = t.announced.match(/(\d{2}\/\d{2}\/\d{4}).*?(\d{1,2}:\d{2}).*?(\d+)/);
  const announced = m ? `${m[1]}  ${m[2]}  (round ${m[3]})` : t.announced;

  const localTime = new Date(p.fetched_at_iso)
    .toLocaleString("en-GB", { hour12: false }).replace(",", "");

  const gap = p.premium_pct;
  const read = gap > 1.2 ? "shops are charging a fat premium - poor moment to buy"
    : gap < -1.2 ? "Thai price has not caught up with world gold yet"
    : "normal, tracking world gold";

  const L = [];
  L.push("  LIVE PRICES" + " ".repeat(28) + localTime);
  L.push("  " + "=".repeat(58));
  L.push("");
  L.push("  " + pad("Gold Spot") + "USD " + money(p.spot.value, 2));
  L.push("  " + pad("USD/THB") + "    " + money(p.fx.value, 3) + "        as of " + p.fx.as_of);
  L.push("");
  L.push("  " + pad("Thai bar sell") + "THB " + money(t.bar_sell) + "     buy  THB " + num(t.bar_buy));
  L.push("  " + pad("Thai ornament sell") + "THB " + money(t.orn_sell) + "     buy  THB " + num(t.orn_buy));
  L.push("  " + pad("Announced") + "    " + announced);
  L.push("");
  L.push("  " + "-".repeat(58));
  L.push("  " + pad("Fair price") + "THB " + money(p.fair_thb));
  L.push("  " + pad("Premium vs fair") + "    " + pct(gap).padStart(10, " ") + "     " + read);
  L.push("");
  L.push("  " + pad("Shop spread") + "THB " + money(t.bar_sell - t.bar_buy) +
         "     gold must clear this before a trade profits");
  return L.join("\n");
}

async function cmdPrices(a) {
  try {
    const p = await fetchPrices();
    console.log(a.pretty || a.p ? prettyPrices(p) : JSON.stringify(p, null, 2));
  } catch (e) { die(e.message); }
}

// Threshold-gated scan: pure code, zero model usage. Callers run the model only
// when this exits 10, which is the rare case.
async function cmdScan(a) {
  let p;
  try { p = await fetchPrices(); } catch (e) { die(e.message); }
  const d = decide(p.thai.bar_sell, p.spot.value, !!a.news);
  if (a.pretty) {
    console.log(prettyPrices(p));
    console.log("");
    console.log(prettyDecision(d, "ALERT CHECK"));
  } else {
    console.log(JSON.stringify({ ...d, prices: p }, null, 2));
  }
  process.exit(d.alert ? 10 : 0);
}

function prettyLog(rows) {
  const done = rows.filter((r) => r.actual_result != null).length;
  const L = [];
  L.push("  TRACK RECORD");
  L.push("  " + "=".repeat(58));
  L.push("  " + rows.length + " rows, " + done + " with an actual result");
  L.push("");
  if (done < MIN_ROWS_FOR_STATS) {
    L.push("  Below " + MIN_ROWS_FOR_STATS + " results, so no accuracy percentage is quoted -");
    L.push("  a run of one-way market would flatter any call.");
  } else {
    const right = rows.filter((r) => /^\u2713/.test(String(r.actual_result))).length;
    const wrong = rows.filter((r) => /^\u2717/.test(String(r.actual_result))).length;
    L.push("  Right " + right + "   Wrong " + wrong + "   Draw " + (done - right - wrong) +
           "   out of " + done + " - past results guarantee nothing.");
  }
  L.push("");
  L.push("  DATE        CALL   SPOT        THAI BAR    OUTCOME");
  L.push("  " + "-".repeat(58));
  for (const r of [...rows].reverse()) {
    const call = String(r.call).toUpperCase().padEnd(6, " ");
    const spot = ("$" + num(r.spot, 0)).padStart(9, " ");
    const thb = num(r.thb_sell).padStart(10, " ");
    let res = "pending, due " + (r.actual_due_display || "?");
    if (r.actual_result != null) {
      const a = String(r.actual_result);
      const mark = a.startsWith("\u2713") ? "RIGHT" : a.startsWith("\u2717") ? "WRONG" : "DRAW ";
      const move = a.match(/\(([+-][\d,]+),\s*([+-][\d.]+%)\)/);
      res = mark + (move ? "  " + move[1] + " THB  " + move[2] : "");
    }
    L.push("  " + String(r.date_iso).padEnd(12, " ") + call + spot + "  " + thb + "  " + res);
  }
  return L.join("\n");
}

// ── build / morning / publish ──────────────────────────────────────────────
function cmdBuild(a, { updateLog = false } = {}) {
  if (!a.in) die("--in <payload.json> is required");
  const payload = readJson(path.resolve(a.in));
  const logFile = readJson(P.log);
  let rows = logFile.rows;
  const notes = [];

  if (updateLog) {
    const L = payload.log;
    if (!L) die("morning requires payload.log");
    for (const k of ["date_display", "date_iso", "actual_due_iso", "actual_due_display"]) {
      if (!L[k]) die(`payload.log is missing: ${k}`);
    }
    if (!payload.call) die("morning requires payload.call (buy|hold|wait)");
    if (!["buy", "hold", "wait"].includes(payload.call)) die("payload.call must be buy|hold|wait");

    const filled = fillActuals(rows, {
      date_iso: L.date_iso, date_display: L.date_display,
      spot: payload.spot.value, thb_sell: payload.thb_bar.sell,
    });
    if (filled.length) notes.push(`filled actual results for ${filled.length} row(s): ${filled.join(", ")}`);

    const row = {
      date_display: L.date_display,
      date_iso: L.date_iso,
      spot: payload.spot.value,
      thb_sell: payload.thb_bar.sell,
      call: payload.call,
      resistance_usd: payload.levels.resistance_usd,
      resistance_thb: payload.levels.resistance_thb,
      support_usd_low: payload.levels.support_usd_low,
      support_usd_high: payload.levels.support_usd_high,
      support_thb: payload.levels.support_thb,
      invalid_note: payload.invalid_text,
      actual_result: null,
      actual_due_iso: L.actual_due_iso,
      actual_due_display: L.actual_due_display,
    };
    const i = rows.findIndex((r) => r.date_iso === L.date_iso);
    if (i >= 0) { rows[i] = { ...rows[i], ...row, actual_result: rows[i].actual_result }; notes.push(`updated existing row for ${L.date_display}`); }
    else { rows.push(row); notes.push(`appended new row for ${L.date_display}`); }
    rows.sort((x, y) => x.date_iso.localeCompare(y.date_iso));
  }

  const html = render(payload, rows);   // validate first, only then touch the disk
  fs.mkdirSync(path.dirname(P.out), { recursive: true });
  fs.writeFileSync(P.out, html);
  if (updateLog) writeJson(P.log, { ...logFile, rows });

  console.log(JSON.stringify({
    ok: true, out: path.relative(ROOT, P.out), bytes: html.length,
    rows: rows.length, notes,
  }, null, 2));
}

function git(...a) {
  return execFileSync("git", a, { cwd: ROOT, encoding: "utf8" }).trim();
}

function cmdPublish(a) {
  const msg = a.m || a.message || `update dashboard ${new Date().toISOString()}`;
  git("add", "-A");
  const staged = execFileSync("git", ["diff", "--cached", "--name-only"], { cwd: ROOT, encoding: "utf8" }).trim();
  if (!staged) return console.log(JSON.stringify({ ok: true, pushed: false, reason: "nothing changed" }, null, 2));
  git("commit", "-m", String(msg));
  git("push");
  const url = (() => {
    try {
      const r = git("remote", "get-url", "origin");
      const m = r.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
      return m ? `https://${m[1]}.github.io/${m[2]}/` : null;
    } catch { return null; }
  })();
  console.log(JSON.stringify({ ok: true, pushed: true, files: staged.split("\n"), url }, null, 2));
}

// ── main ───────────────────────────────────────────────────────────────────
const a = args(process.argv.slice(2));
switch (a._[0]) {
  case "build": cmdBuild(a); break;
  case "morning": cmdBuild(a, { updateLog: true }); break;
  case "publish": cmdPublish(a); break;
  case "check": cmdCheck(a); break;
  case "prices": await cmdPrices(a); break;
  case "scan": await cmdScan(a); break;
  case "state": cmdState(a); break;
  case "log": {
    const lf = readJson(P.log);
    console.log(a.pretty ? prettyLog(lf.rows) : JSON.stringify(lf, null, 2));
    break;
  }
  default:
    console.log(fs.readFileSync(new URL(import.meta.url)).toString().split("\n")
      .slice(1, 14).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
    process.exit(a._[0] ? 1 : 0);
}
