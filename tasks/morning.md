ทำสรุปทองเช้าให้พลอย ตามสกิล gold-watch

โฟลเดอร์งาน: D:\Claude_AI\Ploy\Gold

**1. ค้นราคาจริง** — Gold Spot, ทองแท่งไทยรับซื้อ/ขายออก, ทองรูปพรรณขายออก, USD/THB
จาก Trading Economics, ข่าวไทยที่อ้างสมาคมค้าทองคำ, FXStreet
ห้ามเดาตัวเลขเด็ดขาด ทุกตัวเลขต้องมีเวลาที่เก็บกำกับ
ถ้าสองแหล่งให้ Spot ต่างกันเกิน $20 ให้รายงานเป็นช่วงและบอกว่าเก็บคนละเวลา
ฟิลด์ไหนดึงไม่ได้จริงๆ ให้ใส่ null (rsi, thb_orn) หน้าเว็บจะขึ้น — ให้เอง ห้ามเดามาใส่แทน

**2. เขียนสรุปในแชท** ตามโครง 7 ข้อในสกิล โทนแชทใช้ มึง/กู ได้ตามปกติ

**3. เขียน payload แล้ว publish**
เขียนไฟล์ D:\Claude_AI\Ploy\Gold\data\payload-latest.json ตามโครงใน payload.example.json
ต้องมีครบ: stamp, lede_h1, lede_p, spot, thb_bar, thb_orn, fx, levels, rsi,
read_text, invalid_text, drivers, calendar, sources, call, log
- call เป็นหนึ่งใน buy / hold / wait
- log ใส่ date_display, date_iso, actual_due_iso, actual_due_display (due = 3 วันทำการถัดไป)

แล้วรัน 2 คำสั่งนี้ในโฟลเดอร์งาน:
    node gw.mjs morning --in data/payload-latest.json
    node gw.mjs publish -m "สรุปเช้า <วันที่>"

**ห้ามแก้ docs/index.html ด้วยมือเด็ดขาด** script เป็นคนเติม template คำนวณแนวรับแนวต้าน
และ validate ให้ ถ้า morning ขึ้น error ให้อ่าน error แล้วแก้ที่ payload — ห้ามข้ามขั้นตอน validate

**4. สมุดบันทึกผลงาน** — ไม่ต้องค้นราคาย้อนหลังมาเติมผลจริงเอง
คำสั่ง morning เติมให้อัตโนมัติจากราคารอบนี้ (close-to-close ขยับไม่ถึง ±0.5% นับเสมอ)
ถ้าจะอ้างผลย้อนหลัง ให้อ่านจาก data/log.json
**ยังไม่ถึง 30 แถวที่มีผลจริง ห้ามอ้าง % ความแม่นเด็ดขาด** และเขียนครั้งที่พลาดให้ชัดเท่าครั้งที่ถูก

**5. ส่งอีเมลสรุปเช้า** ถึง iminiwindy@gmail.com และ pongkasame.oil@gmail.com
โทนไทยสุภาพเป็นกลางแบบนักวิเคราะห์ที่เป็นกันเอง **ห้ามใช้ มึง/กู เด็ดขาด** เพราะมีคนอื่นอ่าน
ปุ่ม/ลิงก์ "ดู dashboard เต็ม" ชี้ไปที่ https://ploy230539.github.io/gold-watch/
บอกด้วยว่าลิงก์นี้เปิดได้เลยไม่ต้องล็อกอิน · ปิดท้ายด้วย disclaimer ว่าไม่ใช่คำแนะนำการลงทุน

**6. เช็คเกณฑ์ push** ตามสกิล เข้าเกณฑ์ค่อยยิง ไม่เข้าเกณฑ์ไม่ต้องยิง
