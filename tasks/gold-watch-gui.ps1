# หน้าต่างควบคุม Gold Watch — เปิดด้วยการดับเบิลคลิก "Gold Watch.cmd" ที่โฟลเดอร์หลัก
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$Root = Split-Path -Parent $PSScriptRoot
$Url  = "https://ploy230539.github.io/gold-watch/"

$FontUI   = New-Object System.Drawing.Font("Segoe UI", 9.5)
$FontHead = New-Object System.Drawing.Font("Segoe UI", 9.5, [System.Drawing.FontStyle]::Bold)
$FontMono = New-Object System.Drawing.Font("Consolas", 9)

$form = New-Object System.Windows.Forms.Form
$form.Text = "Gold Watch"
$form.Size = New-Object System.Drawing.Size(760, 720)
$form.StartPosition = "CenterScreen"
$form.Font = $FontUI
$form.BackColor = [System.Drawing.Color]::FromArgb(241, 239, 231)

# ── แถบสถานะบนสุด ─────────────────────────────────────────────────────────
$status = New-Object System.Windows.Forms.Label
$status.Location = New-Object System.Drawing.Point(16, 12)
$status.Size = New-Object System.Drawing.Size(710, 40)
$status.Text = "กำลังตรวจสถานะ..."
$form.Controls.Add($status)

# ── กล่องผลลัพธ์ ──────────────────────────────────────────────────────────
$out = New-Object System.Windows.Forms.TextBox
$out.Multiline = $true
$out.ScrollBars = "Vertical"
$out.ReadOnly = $true
$out.Font = $FontMono
$out.BackColor = [System.Drawing.Color]::FromArgb(28, 26, 20)
$out.ForeColor = [System.Drawing.Color]::FromArgb(242, 237, 225)
$out.Location = New-Object System.Drawing.Point(16, 400)
$out.Size = New-Object System.Drawing.Size(710, 265)
$form.Controls.Add($out)

function Log([string]$text) {
  $out.AppendText($text + "`r`n")
}

# ── ตัวรันคำสั่งแบบไม่ค้างหน้าต่าง ────────────────────────────────────────
$script:proc = $null
$script:oFile = $null
$script:eFile = $null
$script:oPos = 0
$script:ePos = 0
$script:buttons = @()

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 400

function Drain {
  foreach ($pair in @(@($script:oFile, "o"), @($script:eFile, "e"))) {
    $f = $pair[0]; $which = $pair[1]
    if (-not (Test-Path $f)) { continue }
    try {
      $all = [System.IO.File]::ReadAllText($f, [System.Text.Encoding]::UTF8)
    } catch { continue }
    $pos = if ($which -eq "o") { $script:oPos } else { $script:ePos }
    if ($all.Length -gt $pos) {
      $out.AppendText($all.Substring($pos).Replace("`n", "`r`n").Replace("`r`r`n", "`r`n"))
      if ($which -eq "o") { $script:oPos = $all.Length } else { $script:ePos = $all.Length }
    }
  }
}

$timer.Add_Tick({
  Drain
  if ($script:proc -and $script:proc.HasExited) {
    $timer.Stop()
    Start-Sleep -Milliseconds 150
    Drain
    $code = $script:proc.ExitCode
    if ($code -eq 0) { Log "`r`n--- เสร็จเรียบร้อย ---`r`n" }
    else { Log "`r`n--- จบด้วย error (exit $code) ---`r`n" }
    $script:proc = $null
    foreach ($b in $script:buttons) { $b.Enabled = $true }
    RefreshStatus
  }
})

function Run([string]$title, [string]$command) {
  if ($script:proc) { Log "มีคำสั่งกำลังรันอยู่ รอให้เสร็จก่อน"; return }
  $out.Clear()
  Log "> $title"
  Log ("-" * 60)
  $script:oFile = [System.IO.Path]::GetTempFileName()
  $script:eFile = [System.IO.Path]::GetTempFileName()
  $script:oPos = 0; $script:ePos = 0
  foreach ($b in $script:buttons) { $b.Enabled = $false }
  try {
    $script:proc = Start-Process -FilePath "cmd.exe" `
      -ArgumentList "/c", $command `
      -WorkingDirectory $Root -NoNewWindow -PassThru `
      -RedirectStandardOutput $script:oFile -RedirectStandardError $script:eFile
    $timer.Start()
  } catch {
    Log "รันไม่ได้: $_"
    foreach ($b in $script:buttons) { $b.Enabled = $true }
    $script:proc = $null
  }
}

# ── ตัวช่วยสร้างปุ่ม ──────────────────────────────────────────────────────
function AddGroup([string]$text, [int]$x, [int]$y, [int]$w, [int]$h) {
  $g = New-Object System.Windows.Forms.GroupBox
  $g.Text = $text; $g.Font = $FontHead
  $g.Location = New-Object System.Drawing.Point($x, $y)
  $g.Size = New-Object System.Drawing.Size($w, $h)
  $form.Controls.Add($g)
  return $g
}

function AddButton($parent, [string]$text, [int]$x, [int]$y, [int]$w, [scriptblock]$onClick) {
  $b = New-Object System.Windows.Forms.Button
  $b.Text = $text; $b.Font = $FontUI
  $b.Location = New-Object System.Drawing.Point($x, $y)
  $b.Size = New-Object System.Drawing.Size($w, 34)
  $b.BackColor = [System.Drawing.Color]::White
  $b.FlatStyle = "Flat"
  $b.Add_Click($onClick)
  $parent.Controls.Add($b)
  $script:buttons += $b
  return $b
}

# ── กลุ่ม 1: ใช้งานประจำ ──────────────────────────────────────────────────
$g1 = AddGroup "ใช้งานประจำ" 16 60 710 130

AddButton $g1 "สร้างหน้าเว็บใหม่" 16 28 165 {
  Run "สร้างหน้าเว็บจาก data\payload-latest.json" "node gw.mjs build --in data/payload-latest.json"
} | Out-Null

AddButton $g1 "publish ขึ้นเว็บ" 190 28 165 {
  Run "publish ขึ้น GitHub Pages" "node gw.mjs publish"
} | Out-Null

AddButton $g1 "ดูสมุดบันทึกผลงาน" 364 28 165 {
  Run "สมุดบันทึกผลงาน" "node gw.mjs log"
} | Out-Null

AddButton $g1 "เปิดหน้า dashboard" 538 28 155 {
  Start-Process $Url
} | Out-Null

# เช็คเกณฑ์แจ้งเตือน
$lblThb = New-Object System.Windows.Forms.Label
$lblThb.Text = "ทองแท่งขายออก"; $lblThb.Font = $FontUI
$lblThb.Location = New-Object System.Drawing.Point(18, 78)
$lblThb.Size = New-Object System.Drawing.Size(105, 22)
$g1.Controls.Add($lblThb)

$txtThb = New-Object System.Windows.Forms.TextBox
$txtThb.Location = New-Object System.Drawing.Point(124, 75); $txtThb.Size = New-Object System.Drawing.Size(80, 24)
$g1.Controls.Add($txtThb)

$lblXau = New-Object System.Windows.Forms.Label
$lblXau.Text = "Spot"; $lblXau.Font = $FontUI
$lblXau.Location = New-Object System.Drawing.Point(216, 78)
$lblXau.Size = New-Object System.Drawing.Size(38, 22)
$g1.Controls.Add($lblXau)

$txtXau = New-Object System.Windows.Forms.TextBox
$txtXau.Location = New-Object System.Drawing.Point(254, 75); $txtXau.Size = New-Object System.Drawing.Size(80, 24)
$g1.Controls.Add($txtXau)

$chkNews = New-Object System.Windows.Forms.CheckBox
$chkNews.Text = "มีข่าวใหญ่"; $chkNews.Font = $FontUI
$chkNews.Location = New-Object System.Drawing.Point(344, 76); $chkNews.Size = New-Object System.Drawing.Size(95, 24)
$g1.Controls.Add($chkNews)

AddButton $g1 "เช็คว่าถึงเกณฑ์แจ้งไหม" 444 72 175 {
  $t = $txtThb.Text.Trim(); $x = $txtXau.Text.Trim()
  if (-not $t -or -not $x) {
    [System.Windows.Forms.MessageBox]::Show("กรอกราคาทองแท่งขายออกกับ Spot ก่อน", "Gold Watch") | Out-Null
    return
  }
  $news = if ($chkNews.Checked) { " --news" } else { "" }
  Run "เช็คเกณฑ์แจ้งเตือน" "node gw.mjs check --thb $t --xau $x$news"
} | Out-Null

# ── กลุ่ม 2: งานอัตโนมัติ ─────────────────────────────────────────────────
$g2 = AddGroup "งานอัตโนมัติ" 16 200 710 95

AddButton $g2 "รันสรุปเช้าเดี๋ยวนี้" 16 28 165 {
  Run "สรุปทองเช้า" "tasks\run.cmd morning.md & type logs\morning.log"
} | Out-Null

AddButton $g2 "รันสแกนราคาเดี๋ยวนี้" 190 28 165 {
  Run "สแกนเตือนราคา" "tasks\run.cmd watch.md & type logs\watch.log"
} | Out-Null

AddButton $g2 "ตั้งงานอัตโนมัติ" 364 28 165 {
  $r = [System.Windows.Forms.MessageBox]::Show(
    "จะตั้งงานอัตโนมัติ 5 ตัวเข้า Windows Task Scheduler`n`n" +
    "สรุปเช้า 08:00 (จ.-ส.)`nสแกนราคา 10:00 / 15:00 / 20:00 (จ.-ศ.)`nทบทวนตัวเอง วันที่ 1 เวลา 09:00`n`n" +
    "ต้องลง Claude Code CLI และ login ให้เรียบร้อยก่อน (ดูกลุ่มล่างสุด)",
    "ยืนยัน", "OKCancel", "Question")
  if ($r -eq "OK") {
    Run "ตั้งงานอัตโนมัติ" "powershell -NoProfile -ExecutionPolicy Bypass -File tasks\setup-windows-tasks.ps1"
  }
} | Out-Null

AddButton $g2 "ลบงานอัตโนมัติ" 538 28 155 {
  $r = [System.Windows.Forms.MessageBox]::Show("ลบงานอัตโนมัติทั้ง 5 ตัวออกจาก Task Scheduler?", "ยืนยัน", "OKCancel", "Warning")
  if ($r -eq "OK") {
    $names = "GoldWatch-Morning GoldWatch-Scan-1000 GoldWatch-Scan-1500 GoldWatch-Scan-2000 GoldWatch-Review"
    $cmd = ($names.Split(" ") | ForEach-Object { "schtasks /Delete /TN $_ /F" }) -join " & "
    Run "ลบงานอัตโนมัติ" $cmd
  }
} | Out-Null

# ── กลุ่ม 3: ตั้งค่าครั้งแรก ──────────────────────────────────────────────
$g3 = AddGroup "ตั้งค่าครั้งแรก — ทำครั้งเดียว เรียงตามลำดับ" 16 305 710 85

AddButton $g3 "1. ลง Claude Code CLI" 16 28 200 {
  Run "ติดตั้ง Claude Code CLI" "npm install -g @anthropic-ai/claude-code"
} | Out-Null

AddButton $g3 "2. login + ต่อ connector" 225 28 200 {
  [System.Windows.Forms.MessageBox]::Show(
    "จะเปิดหน้าต่าง claude ขึ้นมา`n`n" +
    "ในหน้าต่างนั้นให้ login ให้เรียบร้อย แล้วพิมพ์ /mcp เพื่อต่อ connector`n" +
    "Gmail (ส่งอีเมล) และ push notification`n`n" +
    "เสร็จแล้วปิดหน้าต่างนั้น แล้วกดปุ่มที่ 3 เพื่อทดสอบ",
    "ขั้นตอนที่ 2", "OK", "Information") | Out-Null
  Start-Process "cmd.exe" -ArgumentList "/k", "cd /d `"$Root`" && claude"
} | Out-Null

AddButton $g3 "3. ทดสอบส่งอีเมล" 434 28 200 {
  Run "ทดสอบส่งอีเมล" "claude -p `"ส่งอีเมลทดสอบหัวข้อ 'Gold Watch ทดสอบระบบ' ถึง iminiwindy@gmail.com`""
} | Out-Null

# ── สถานะ ─────────────────────────────────────────────────────────────────
function RefreshStatus {
  $hasNode = [bool](Get-Command node -ErrorAction SilentlyContinue)
  $hasCli  = [bool](Get-Command claude -ErrorAction SilentlyContinue)
  $names = @("GoldWatch-Morning","GoldWatch-Scan-1000","GoldWatch-Scan-1500","GoldWatch-Scan-2000","GoldWatch-Review")
  $n = 0
  foreach ($t in $names) {
    schtasks /Query /TN $t 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $n++ }
  }
  $parts = @()
  $parts += if ($hasNode) { "Node OK" } else { "ไม่พบ Node" }
  $parts += if ($hasCli)  { "Claude CLI OK" } else { "ยังไม่ได้ลง Claude CLI (กดปุ่ม 1)" }
  $parts += "งานอัตโนมัติที่ตั้งไว้ $n / 5"
  $status.Text = "โฟลเดอร์: $Root`r`n" + ($parts -join "   ·   ")
  $status.ForeColor = if ($hasNode -and $hasCli -and $n -eq 5) {
    [System.Drawing.Color]::FromArgb(26, 112, 72)
  } else {
    [System.Drawing.Color]::FromArgb(138, 90, 18)
  }
}

RefreshStatus
Log "พร้อมใช้งาน — กดปุ่มด้านบนได้เลย"
Log ""
Log "ถ้ายังไม่เคยตั้งงานอัตโนมัติ ให้ทำกลุ่มล่างสุดตามลำดับ 1 -> 2 -> 3 ก่อน"
Log "แล้วค่อยกด `"ตั้งงานอัตโนมัติ`""

[void]$form.ShowDialog()
