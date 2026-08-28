# งานอัตโนมัติ 3 ตัว — ย้ายมารันบนเครื่องพลอย

URL ใหม่ที่ใช้แทน Artifact เดิมทุกจุด (อีเมล ปุ่ม CTA แชท push):

```
https://ploy230539.github.io/gold-watch/
```

Artifact เดิม `751af5ad-2435-4077-8879-2bd35a1ccaa8` **เลิกใช้แล้ว**

---

## ตารางเวลาใหม่

| งาน | เมื่อไหร่ | prompt |
|---|---|---|
| สรุปทองเช้า | 08:00 น. จ.–ส. | `tasks/morning.md` |
| สแกนเตือนราคา | **10:00 / 15:00 / 20:00 น.** จ.–ศ. | `tasks/watch.md` |
| ทบทวนตัวเองต้นเดือน | วันที่ 1 เวลา 09:00 น. | `tasks/review.md` |

เวลาสแกนเปลี่ยนจากของเดิม (09/12/15/18 น. 4 รอบ) มาเป็น 10/15/20 น. 3 รอบ
ให้ตรงกับที่เขียนไว้ในสกิล `gold-watch` ข้อ 10

---

## ติดตั้ง — 3 ขั้น

### 1. ติดตั้ง Claude Code CLI

เครื่องนี้มีแต่ Claude Code เวอร์ชัน desktop app ซึ่ง Task Scheduler เรียกไม่ได้
ต้องลง CLI เพิ่ม (ตรวจแล้วว่ายังไม่มี):

```bash
npm install -g @anthropic-ai/claude-code
```

### 2. login + ต่อ connector หนึ่งครั้ง

เปิด `claude` แบบ interactive ในโฟลเดอร์ `D:\Claude_AI\Ploy\Gold` แล้ว login
จากนั้นต่อ connector ที่งานต้องใช้ให้ครบ — **Gmail** (ส่งอีเมล) และ **push notification**
ขั้นนี้ต้องมีคนกดเอง ทำแทนไม่ได้ ถ้าข้ามไป งานจะรันได้แต่ส่งอีเมลไม่ออก

ทดสอบว่าใช้ได้จริงก่อน:

```bash
claude -p "ส่งอีเมลทดสอบหัวข้อ 'Gold Watch ทดสอบระบบ' ถึง iminiwindy@gmail.com"
```

### 3. ลงทะเบียนงานเข้า Task Scheduler

```bash
powershell -ExecutionPolicy Bypass -File tasks\setup-windows-tasks.ps1
```

ลองยิงรอบแรกดูเลย:

```bash
schtasks /Run /TN GoldWatch-Morning
```

log ของแต่ละรอบเก็บที่ `logs\` ในโฟลเดอร์งาน

---

## ข้อแลกเปลี่ยนที่ต้องรู้

- **เครื่องต้องเปิดอยู่ตอนถึงเวลา** ถ้าปิดอยู่ รอบนั้นข้ามไปเลย ไม่มีการรันย้อนหลัง
  (`/SC WEEKLY` ของ schtasks ไม่ทำ catch-up ให้)
  ระบบเฝ้าราคาไม่พังเพราะเรื่องนี้ — เกณฑ์ 150 บาทนับสะสมจากรอบที่ **แจ้งจริง** ครั้งล่าสุด
  ข้ามรอบไปแล้วรอบถัดไปยังเทียบถูก
- ตัวรัน (`tasks/run.cmd`) ใช้ `--dangerously-skip-permissions` เพราะไม่มีคนอยู่หน้าเครื่องคอยกดอนุญาต
  prompt ทั้ง 3 เป็นไฟล์ในเครื่องที่เขียนไว้ตายตัว ไม่ได้รับ input จากภายนอก
  **ถ้าจะแก้ prompt ให้แก้ที่ไฟล์ใน `tasks/` เท่านั้น**
- ลบงานทิ้ง: `schtasks /Delete /TN GoldWatch-Morning /F` (ทำทีละชื่อ)

---

## ทางเลือกสำรอง — ถ้าไม่อยากพึ่งเครื่องเปิด

repo มี GitHub Action (`.github/workflows/build.yml`) ที่ทำหน้าที่เติม template + validate +
commit `docs/index.html` ให้อยู่แล้ว ถ้าวันไหนอยากย้ายกลับไปรันบน claude.ai
ให้ต่อ GitHub connector บน claude.ai แล้วให้ task เขียนแค่ `data/payload-latest.json`
ขึ้น repo `ploy230539/gold-watch` branch `main` — Action จะ build ให้เอง
(task บน claude.ai ไม่มี shell จึงรัน `gw.mjs` เองไม่ได้ ต้องผ่าน Action เป็นสะพาน)

Action ยังทำงานอยู่ตอนนี้ในฐานะตาข่ายกันพลาด — ทุกครั้งที่ `data/` เปลี่ยน มันจะ validate ซ้ำให้

---

## เนื้อ prompt ทั้ง 3

อยู่ในไฟล์จริงที่ `tasks/morning.md`, `tasks/watch.md`, `tasks/review.md`
สิ่งที่คงไว้เหมือนเดิมครบ: สูตรราคาที่ควรเป็น · เกณฑ์ 150/300 บาท และ 1.5% ·
เกณฑ์ push แรง · กฎ 30 แถว · โทนอีเมลสุภาพห้าม มึง/กู · ผู้รับ 2 คน
