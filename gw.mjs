#!/usr/bin/env node
// Gold Watch — build / state / publish
// ไม่มี dependency ภายนอก รันด้วย node >= 18
//
//   node gw.mjs build   --in payload.json          เติม template -> docs/index.html (ไม่แตะ log)
//   node gw.mjs morning --in payload.json          เติม actual ที่ถึงกำหนด + เพิ่มแถวใหม่ + build
//   node gw.mjs publish [-m "msg"]                 commit + push ขึ้น GitHub Pages
//   node gw.mjs check   --thb N --xau N [--news]   เทียบกับราคาที่แจ้งครั้งล่าสุด -> ควรแจ้งไหม
//   node gw.mjs state get|set --thb N --xau N [--note "..."]
//   node gw.mjs log                                พิมพ์สมุดบันทึกผลงานเป็น JSON

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

// ── ค่าคงที่ของระบบ (ห้ามแก้โดยไม่ตั้งใจ — ดู README) ───────────────────────
const GRAMS_PER_OZ = 31.1035;
const GRAMS_PER_BAHT = 15.244;
const THAI_PURITY = 0.965;

/** ราคาทองไทยที่ควรเป็น (บาท/บาททอง) */
export function fairThb(spot, usdthb) {
  return (spot / GRAMS_PER_OZ) * GRAMS_PER_BAHT * THAI_PURITY * usdthb;
}

// เกณฑ์แจ้งเตือนของระบบเฝ้าราคา
const ALERT_THB = 150;   // ทองไทยขยับ >= 150 บาท จากราคาที่แจ้งครั้งล่าสุด (สะสมได้)
const ALERT_XAU_PCT = 1.5;
const PUSH_THB = 300;    // ต่ำกว่านี้ส่งแค่อีเมล ไม่เด้งมือถือ
const PUSH_XAU_PCT = 1.5;
const MIN_ROWS_FOR_STATS = 30; // ต่ำกว่านี้ห้ามอ้าง % ความแม่น

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
// bottom% = (ราคา − ขอบล่างช่วง) ÷ (ขอบบน − ขอบล่าง) × 100
// เผื่อขอบบน/ล่าง 8% ของช่วง เพื่อไม่ให้จุดไปติดขอบราง
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

// ── ชิ้นส่วน HTML ที่ generate จากข้อมูล ────────────────────────────────────
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
// ต้องมีค่าจริง ห้าม null
const REQUIRED = [
  "stamp", "lede_h1", "lede_p", "spot", "thb_bar", "thb_orn", "fx",
  "levels", "read_text", "invalid_text", "drivers", "calendar", "sources",
];
// ต้องมี key แต่ใส่ null ได้ (แปลว่า "รอบนี้ดึงไม่ได้" ไม่ใช่ "ลืมใส่")
const NULLABLE = ["rsi"];

function render(payload, rows) {
  const missing = REQUIRED.filter((k) => payload[k] === undefined || payload[k] === null);
  if (missing.length) die("payload ขาดฟิลด์: " + missing.join(", "));
  const absent = NULLABLE.filter((k) => !(k in payload));
  if (absent.length) die("payload ต้องมี key เหล่านี้ (ใส่ null ได้ถ้าดึงไม่ได้): " + absent.join(", "));

  const { spot, thb_bar, thb_orn, fx, levels } = payload;
  for (const [obj, keys, name] of [
    [spot, ["value", "delta_pct", "sub"], "spot"],
    [thb_bar, ["sell", "delta", "sub"], "thb_bar"],
    [fx, ["value", "delta_pct", "sub"], "fx"],
    [levels, ["resistance_usd", "resistance_thb", "support_usd_low", "support_usd_high", "support_thb"], "levels"],
  ]) {
    const miss = keys.filter((k) => obj[k] === undefined || obj[k] === null);
    if (miss.length) die(`payload.${name} ขาด: ${miss.join(", ")}`);
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

    // ทองรูปพรรณเป็นข้อมูลเสริม ถ้ารอบนั้นดึงไม่ได้ให้ขึ้น — แทนการเดา
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
    if (!(key in map)) die(`template มี placeholder ที่ script ไม่รู้จัก: ${m}`);
    return map[key];
  });

  const left = html.match(/\{\{[A-Za-z0-9_]+\}\}/g);
  if (left) die("ยังมี placeholder เหลือหลังเติม: " + [...new Set(left)].join(", "));

  return html;
}

// ── สมุดบันทึกผลงาน: เติม actual_result ที่ถึงกำหนดอัตโนมัติ ───────────────
// วัดแบบ close-to-close: เทียบราคาวันนี้กับราคาที่จดไว้ในแถวนั้น
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

    // ±0.5% = ถือว่าเสมอ (ต่ำกว่าส่วนต่างซื้อ-ขายของร้าน เทรดแล้วไม่เหลือ)
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

// ── state (ความจำของระบบเฝ้าราคา) ──────────────────────────────────────────
function loadState() {
  if (!fs.existsSync(P.state)) return { last_alert: null, history: [] };
  return readJson(P.state);
}
const subjectCode = (thb, xau) => `[TH ${Math.round(thb)} | XAU ${Math.round(xau)}]`;

function cmdCheck(a) {
  const thb = Number(a.thb), xau = Number(a.xau);
  if (!Number.isFinite(thb) || !Number.isFinite(xau)) die("check ต้องมี --thb และ --xau");
  const news = !!a.news;
  const st = loadState();
  const ref = st.last_alert;

  if (!ref) {
    return console.log(JSON.stringify({
      alert: true, push: news, reason: "ยังไม่เคยแจ้ง — ตั้งค่าอ้างอิงครั้งแรก",
      ref: null, thb_move: null, xau_pct: null,
      subject_code: subjectCode(thb, xau),
    }, null, 2));
  }

  const thbMove = thb - ref.thb_sell;
  const xauPct = ((xau - ref.xau) / ref.xau) * 100;
  const hitThb = Math.abs(thbMove) >= ALERT_THB;
  const hitXau = Math.abs(xauPct) >= ALERT_XAU_PCT;
  const alert = hitThb || hitXau || news;
  const push = Math.abs(thbMove) >= PUSH_THB || Math.abs(xauPct) >= PUSH_XAU_PCT || news;

  const reasons = [];
  if (hitThb) reasons.push(`ทองไทยขยับ ${signed(thbMove)} บาท จากที่แจ้งครั้งล่าสุด (เกณฑ์ ${ALERT_THB})`);
  if (hitXau) reasons.push(`Spot ขยับ ${pct(xauPct)} จากที่แจ้งครั้งล่าสุด (เกณฑ์ ${ALERT_XAU_PCT}%)`);
  if (news) reasons.push("มีข่าวใหญ่ระดับเขย่าตลาด");
  if (!alert) reasons.push(`ไม่ถึงเกณฑ์ — ทองไทย ${signed(thbMove)} บาท / Spot ${pct(xauPct)} → เงียบ ไม่ส่งอะไร`);

  console.log(JSON.stringify({
    alert, push,
    channels: alert ? (push ? ["email", "push", "chat"] : ["email", "chat"]) : [],
    reason: reasons.join(" · "),
    ref: { thb_sell: ref.thb_sell, xau: ref.xau, ts_iso: ref.ts_iso },
    now: { thb_sell: thb, xau },
    thb_move: Math.round(thbMove),
    xau_pct: Number(xauPct.toFixed(3)),
    subject_code: subjectCode(thb, xau),
  }, null, 2));
}

function cmdState(a) {
  const sub = a._[1];
  if (sub === "get" || !sub) {
    const st = loadState();
    return console.log(JSON.stringify(st.last_alert, null, 2));
  }
  if (sub !== "set") die("ใช้ได้: state get | state set --thb N --xau N");
  const thb = Number(a.thb), xau = Number(a.xau);
  if (!Number.isFinite(thb) || !Number.isFinite(xau)) die("state set ต้องมี --thb และ --xau");
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

// ── build / morning / publish ──────────────────────────────────────────────
function cmdBuild(a, { updateLog = false } = {}) {
  if (!a.in) die("ต้องระบุ --in <payload.json>");
  const payload = readJson(path.resolve(a.in));
  const logFile = readJson(P.log);
  let rows = logFile.rows;
  const notes = [];

  if (updateLog) {
    const L = payload.log;
    if (!L) die("morning ต้องมี payload.log");
    for (const k of ["date_display", "date_iso", "actual_due_iso", "actual_due_display"]) {
      if (!L[k]) die(`payload.log ขาด: ${k}`);
    }
    if (!payload.call) die("morning ต้องมี payload.call (buy|hold|wait)");
    if (!["buy", "hold", "wait"].includes(payload.call)) die("payload.call ต้องเป็น buy|hold|wait");

    const filled = fillActuals(rows, {
      date_iso: L.date_iso, date_display: L.date_display,
      spot: payload.spot.value, thb_sell: payload.thb_bar.sell,
    });
    if (filled.length) notes.push(`เติมผลจริงย้อนหลัง ${filled.length} แถว: ${filled.join(", ")}`);

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
    if (i >= 0) { rows[i] = { ...rows[i], ...row, actual_result: rows[i].actual_result }; notes.push(`อัปเดตแถววันที่ ${L.date_display} (มีอยู่แล้ว)`); }
    else { rows.push(row); notes.push(`เพิ่มแถวใหม่ ${L.date_display}`); }
    rows.sort((x, y) => x.date_iso.localeCompare(y.date_iso));
  }

  const html = render(payload, rows);   // validate ก่อน แล้วค่อยเขียนอะไรลงดิสก์
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
  if (!staged) return console.log(JSON.stringify({ ok: true, pushed: false, reason: "ไม่มีอะไรเปลี่ยน" }, null, 2));
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
  case "state": cmdState(a); break;
  case "log": console.log(fs.readFileSync(P.log, "utf8")); break;
  default:
    console.log(fs.readFileSync(new URL(import.meta.url)).toString().split("\n")
      .slice(1, 14).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
    process.exit(a._[0] ? 1 : 0);
}
