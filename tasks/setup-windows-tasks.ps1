# ลงทะเบียน Gold Watch เข้า Windows Task Scheduler
# รันครั้งเดียวใน PowerShell (ไม่ต้อง Run as Administrator)
#
#   powershell -ExecutionPolicy Bypass -File tasks\setup-windows-tasks.ps1
#
# ต้องทำก่อน 2 อย่าง (ดู PROMPTS.md):
#   1) npm install -g @anthropic-ai/claude-code
#   2) เปิด claude แบบ interactive หนึ่งครั้ง แล้ว login + ต่อ connector Gmail / Drive / push ให้ครบ
#      ไม่งั้นงานจะรันได้แต่ส่งอีเมลไม่ได้

$ErrorActionPreference = "Stop"

if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
  Write-Error "ยังไม่ได้ติดตั้ง Claude Code CLI — รัน: npm install -g @anthropic-ai/claude-code"
}

$run = Join-Path $PSScriptRoot "run.cmd"
if (-not (Test-Path $run)) { Write-Error "ไม่พบ $run" }

# schtasks รองรับ MONTHLY /D 1 ตรงๆ (New-ScheduledTaskTrigger ทำ "วันที่ 1 ของเดือน" ไม่ได้)
$jobs = @(
  @{ Name = "GoldWatch-Morning";    Prompt = "morning.md"; Sc = @("/SC","WEEKLY","/D","MON,TUE,WED,THU,FRI,SAT","/ST","08:00")
     Desc = "สรุปทองเช้า 08:00 น. จ.-ส." }
  @{ Name = "GoldWatch-Scan-1000";  Prompt = "watch.md";   Sc = @("/SC","WEEKLY","/D","MON,TUE,WED,THU,FRI","/ST","10:00")
     Desc = "สแกนเตือนราคาทอง 10:00 น. จ.-ศ." }
  @{ Name = "GoldWatch-Scan-1500";  Prompt = "watch.md";   Sc = @("/SC","WEEKLY","/D","MON,TUE,WED,THU,FRI","/ST","15:00")
     Desc = "สแกนเตือนราคาทอง 15:00 น. จ.-ศ." }
  @{ Name = "GoldWatch-Scan-2000";  Prompt = "watch.md";   Sc = @("/SC","WEEKLY","/D","MON,TUE,WED,THU,FRI","/ST","20:00")
     Desc = "สแกนเตือนราคาทอง 20:00 น. จ.-ศ." }
  @{ Name = "GoldWatch-Review";     Prompt = "review.md";  Sc = @("/SC","MONTHLY","/D","1","/ST","09:00")
     Desc = "ทบทวนตัวเองต้นเดือน วันที่ 1 เวลา 09:00 น." }
)

foreach ($j in $jobs) {
  schtasks /Delete /TN $j.Name /F 2>$null | Out-Null
  $tr = '"' + $run + '" ' + $j.Prompt
  $argv = @("/Create","/TN",$j.Name,"/TR",$tr) + $j.Sc + @("/F","/RL","LIMITED")
  & schtasks @argv | Out-Null
  if ($LASTEXITCODE -ne 0) { Write-Error "ลงทะเบียน $($j.Name) ไม่สำเร็จ" }
  Write-Host "ลงทะเบียนแล้ว: $($j.Name) — $($j.Desc)"
}

Write-Host ""
Write-Host "งานจะรันเฉพาะตอนเครื่องเปิดอยู่ ถ้าเครื่องปิดรอบนั้นจะข้ามไปเลย"
Write-Host "log อยู่ที่ logs\ ในโฟลเดอร์งาน"
Write-Host ""
Write-Host "ดูงานทั้งหมด:  schtasks /Query /TN GoldWatch-Morning"
Write-Host "ลองรันเลย:     schtasks /Run /TN GoldWatch-Morning"
Write-Host "ลบทิ้ง:        schtasks /Delete /TN GoldWatch-Morning /F"
