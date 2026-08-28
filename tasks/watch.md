เฝ้าราคาทองให้พลอย ตามสกิล gold-watch

โฟลเดอร์งาน: D:\Claude_AI\Ploy\Gold

**1. อ่านราคาที่แจ้งไปครั้งล่าสุด**
    node gw.mjs state get
ได้ thb_sell (ทองแท่งขายออก) กับ xau (Spot ปัดเต็ม) — นี่คือค่าอ้างอิง
ถ้าไฟล์ state มีปัญหา ให้ fallback ไปอ่านรหัสท้าย subject อีเมลแบบเดิม
(Gmail search: in:sent subject:"ทองขยับ" newer_than:2d รูปแบบ [TH <ขายออก> | XAU <spot>])
แล้วบอกในแชทว่า state file มีปัญหา

**2. เช็คราคาปัจจุบันจริง** จากเว็บ ห้ามเดา

**3. ให้ script ตัดสินเกณฑ์**
    node gw.mjs check --thb <ทองแท่งขายออกตอนนี้> --xau <spot ตอนนี้>
ถ้ามีข่าวใหญ่ระดับเขย่าตลาด ให้เติม --news ต่อท้าย (ข่าวใหญ่คนตัดสิน ไม่ใช่ script)

script คืน alert / push / channels มาให้ ทำตามนั้น:
- alert = false → **เงียบสนิท ไม่ส่งอะไรเลย ไม่ต้องเขียนอะไรในแชทด้วย**
  การเตือนที่ไม่จำเป็นทำให้พลอยเลิกอ่านการเตือนที่จำเป็น
- alert = true, push = false (ขยับ 150–300 บาท) → อีเมล + แชท **ไม่ต้องเด้ง push**
- alert = true, push = true (≥300 บาท / Spot ≥1.5% / ข่าวใหญ่) → อีเมล + push + แชท

**4. ถ้าส่ง** — อีเมลถึง iminiwindy@gmail.com และ pongkasame.oil@gmail.com
โทนไทยสุภาพเป็นกลาง **ห้าม มึง/กู** (แชทกับ push ใช้ได้ตามปกติ)
subject ลงท้ายด้วย subject_code ที่ script คืนมา เช่น [TH 71500 | XAU 4620]
ลิงก์ dashboard ในอีเมล/แชท/push ใช้ https://ploy230539.github.io/gold-watch/

**5. หลังส่งเสร็จเท่านั้น** บันทึกราคาที่เพิ่งแจ้ง แล้ว push ขึ้น repo:
    node gw.mjs state set --thb <ที่แจ้ง> --xau <ที่แจ้ง> --note "<ทำไมถึงแจ้ง>"
    node gw.mjs publish -m "state: แจ้งราคา <เวลา>"
**ถ้าไม่ได้ส่ง ห้ามแตะ state** ไม่งั้นการนับแบบสะสมจะเพี้ยน

รอบนี้ห้ามแตะ payload-latest.json, log.json, docs/index.html
