# Gold Watch control panel -- launch by double-clicking "Gold Watch.cmd" in the project root
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$Root = Split-Path -Parent $PSScriptRoot
$Url  = "https://ploy230539.github.io/gold-watch/"

$FontUI   = New-Object System.Drawing.Font("Segoe UI", 9.5)
$FontHead = New-Object System.Drawing.Font("Segoe UI", 9.5, [System.Drawing.FontStyle]::Bold)
$FontMono = New-Object System.Drawing.Font("Consolas", 9.5)

$form = New-Object System.Windows.Forms.Form
$form.Text = "Gold Watch"
$form.Size = New-Object System.Drawing.Size(760, 720)
$form.StartPosition = "CenterScreen"
$form.Font = $FontUI
$form.BackColor = [System.Drawing.Color]::FromArgb(241, 239, 231)

# -- status bar ------------------------------------------------------------
$status = New-Object System.Windows.Forms.Label
$status.Location = New-Object System.Drawing.Point(16, 12)
$status.Size = New-Object System.Drawing.Size(710, 40)
$status.Text = "Checking status..."
$form.Controls.Add($status)

# -- output box ------------------------------------------------------------
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
  $out.SelectionStart = $out.TextLength
  $out.ScrollToCaret()
}

function HasClaude { [bool](Get-Command claude -ErrorAction SilentlyContinue) }

# -- command runner (keeps the window responsive) --------------------------
# stdout and stderr are merged by cmd itself (> file 2>&1), then the file is
# read with a shared handle so it can never fail while the child is writing.
$script:proc = $null
$script:logFile = $null
$script:pos = 0
$script:buttons = @()

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 350

function Drain {
  if (-not $script:logFile -or -not (Test-Path $script:logFile)) { return }
  try {
    $fs = New-Object System.IO.FileStream($script:logFile, [System.IO.FileMode]::Open,
      [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
    try {
      if ($fs.Length -le $script:pos) { return }
      [void]$fs.Seek($script:pos, [System.IO.SeekOrigin]::Begin)
      $buf = New-Object byte[] ($fs.Length - $script:pos)
      $read = $fs.Read($buf, 0, $buf.Length)
      $script:pos += $read
      $text = [System.Text.Encoding]::UTF8.GetString($buf, 0, $read)
      if ($text) {
        $out.AppendText($text.Replace("`r`n", "`n").Replace("`n", "`r`n"))
        $out.SelectionStart = $out.TextLength
        $out.ScrollToCaret()
      }
    } finally { $fs.Close() }
  } catch { }
}

$timer.Add_Tick({
  Drain
  if ($script:proc -and $script:proc.HasExited) {
    $timer.Stop()
    Start-Sleep -Milliseconds 200
    Drain
    $code = -1
    try { $script:proc.WaitForExit(); $code = $script:proc.ExitCode } catch { }
    if ($code -eq $null) { $code = -1 }
    if ($code -eq 0) {
      Log "`r`n--- Done ---`r`n"
    } else {
      Log "`r`n--- Failed (exit $code) ---"
      if (-not (HasClaude)) {
        Log "Most likely cause: Claude Code CLI is not installed."
        Log "Press '1. Install Claude Code CLI' in the setup group below, then retry."
      }
      Log ""
    }
    $script:proc = $null
    foreach ($b in $script:buttons) { $b.Enabled = $true }
    RefreshStatus
  }
})

function Run([string]$title, [string]$command) {
  if ($script:proc) { Log "A command is still running. Wait for it to finish."; return }
  $out.Clear()
  Log "> $title"
  Log ("-" * 60)
  $script:logFile = [System.IO.Path]::GetTempFileName()
  $script:pos = 0
  foreach ($b in $script:buttons) { $b.Enabled = $false }
  try {
    $full = "chcp 65001 >nul & ($command) > `"$($script:logFile)`" 2>&1"
    $script:proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $full `
      -WorkingDirectory $Root -NoNewWindow -PassThru
    # PowerShell 5.1 quirk: ExitCode stays empty unless the handle is cached here
    $null = $script:proc.Handle
    $timer.Start()
  } catch {
    Log "Could not start: $_"
    foreach ($b in $script:buttons) { $b.Enabled = $true }
    $script:proc = $null
  }
}

# Commands that need the Claude CLI -- check first so the user gets a clear
# message instead of a raw "'claude' is not recognized" error.
function RunNeedsClaude([string]$title, [string]$command) {
  if (-not (HasClaude)) {
    [System.Windows.Forms.MessageBox]::Show(
      "Claude Code CLI is not installed, so this job cannot run.`n`n" +
      "Press '1. Install Claude Code CLI' in the setup group below,`n" +
      "then '2. Log in + connect' to sign in and add connectors,`n" +
      "then '3. Send test email' to confirm it actually works.",
      "Setup incomplete", "OK", "Warning") | Out-Null
    return
  }
  Run $title $command
}

# -- helpers ---------------------------------------------------------------
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

# -- group 1: everyday -----------------------------------------------------
$g1 = AddGroup "Everyday" 16 60 710 130

AddButton $g1 "Rebuild page" 16 28 165 {
  Run "Build page from data\payload-latest.json" "node gw.mjs build --in data/payload-latest.json"
} | Out-Null

AddButton $g1 "Publish to web" 190 28 165 {
  Run "Publish to GitHub Pages" "node gw.mjs publish"
} | Out-Null

AddButton $g1 "View track record" 364 28 165 {
  Run "Track record log" "node gw.mjs log"
} | Out-Null

AddButton $g1 "Open dashboard" 538 28 155 {
  Start-Process $Url
} | Out-Null

$lblThb = New-Object System.Windows.Forms.Label
$lblThb.Text = "THB bar sell"; $lblThb.Font = $FontUI
$lblThb.Location = New-Object System.Drawing.Point(18, 78)
$lblThb.Size = New-Object System.Drawing.Size(88, 22)
$g1.Controls.Add($lblThb)

$txtThb = New-Object System.Windows.Forms.TextBox
$txtThb.Font = $FontUI
$txtThb.Location = New-Object System.Drawing.Point(108, 75); $txtThb.Size = New-Object System.Drawing.Size(80, 24)
$g1.Controls.Add($txtThb)

$lblXau = New-Object System.Windows.Forms.Label
$lblXau.Text = "XAU spot"; $lblXau.Font = $FontUI
$lblXau.Location = New-Object System.Drawing.Point(200, 78)
$lblXau.Size = New-Object System.Drawing.Size(64, 22)
$g1.Controls.Add($lblXau)

$txtXau = New-Object System.Windows.Forms.TextBox
$txtXau.Font = $FontUI
$txtXau.Location = New-Object System.Drawing.Point(266, 75); $txtXau.Size = New-Object System.Drawing.Size(80, 24)
$g1.Controls.Add($txtXau)

$chkNews = New-Object System.Windows.Forms.CheckBox
$chkNews.Text = "Big news"; $chkNews.Font = $FontUI
$chkNews.Location = New-Object System.Drawing.Point(356, 76); $chkNews.Size = New-Object System.Drawing.Size(84, 24)
$g1.Controls.Add($chkNews)

AddButton $g1 "Check alert thresholds" 444 72 175 {
  $t = $txtThb.Text.Trim(); $x = $txtXau.Text.Trim()
  if (-not $t -or -not $x) {
    [System.Windows.Forms.MessageBox]::Show("Enter both the THB bar sell price and the XAU spot price first.", "Gold Watch") | Out-Null
    return
  }
  $news = if ($chkNews.Checked) { " --news" } else { "" }
  Run "Check alert thresholds" "node gw.mjs check --thb $t --xau $x$news"
} | Out-Null

# -- group 2: scheduled jobs -----------------------------------------------
$g2 = AddGroup "Scheduled jobs" 16 200 710 95

AddButton $g2 "Run morning brief now" 16 28 165 {
  RunNeedsClaude "Morning brief (takes several minutes)" "tasks\run.cmd morning.md & type logs\morning.log"
} | Out-Null

AddButton $g2 "Run price scan now" 190 28 165 {
  RunNeedsClaude "Price scan" "tasks\run.cmd watch.md & type logs\watch.log"
} | Out-Null

AddButton $g2 "Install schedule" 364 28 165 {
  if (-not (HasClaude)) {
    [System.Windows.Forms.MessageBox]::Show(
      "Claude Code CLI is not installed -- the scheduled jobs would fail.`n`n" +
      "Complete steps 1 -> 2 -> 3 in the setup group below first.",
      "Setup incomplete", "OK", "Warning") | Out-Null
    return
  }
  $r = [System.Windows.Forms.MessageBox]::Show(
    "Register 5 scheduled jobs in Windows Task Scheduler?`n`n" +
    "Morning brief  08:00  Mon-Sat`n" +
    "Price scan     10:00 / 15:00 / 20:00  Mon-Fri`n" +
    "Self review    09:00  1st of each month",
    "Confirm", "OKCancel", "Question")
  if ($r -eq "OK") {
    Run "Install schedule" "powershell -NoProfile -ExecutionPolicy Bypass -File tasks\setup-windows-tasks.ps1"
  }
} | Out-Null

AddButton $g2 "Remove schedule" 538 28 155 {
  $r = [System.Windows.Forms.MessageBox]::Show("Remove all 5 Gold Watch jobs from Task Scheduler?", "Confirm", "OKCancel", "Warning")
  if ($r -eq "OK") {
    $names = @("GoldWatch-Morning","GoldWatch-Scan-1000","GoldWatch-Scan-1500","GoldWatch-Scan-2000","GoldWatch-Review")
    $cmd = ($names | ForEach-Object { "schtasks /Delete /TN $_ /F" }) -join " & "
    Run "Remove schedule" $cmd
  }
} | Out-Null

# -- group 3: one-time setup -----------------------------------------------
$g3 = AddGroup "First-time setup -- run once, in order" 16 305 710 85

AddButton $g3 "1. Install Claude Code CLI" 16 28 200 {
  Log "Installing. This can take 1-3 minutes -- wait for 'Done'."
  Run "Install Claude Code CLI" "npm install -g @anthropic-ai/claude-code"
} | Out-Null

AddButton $g3 "2. Log in + connect" 225 28 200 {
  if (-not (HasClaude)) {
    [System.Windows.Forms.MessageBox]::Show("Press button 1 and let the install finish first.", "Not ready", "OK", "Warning") | Out-Null
    return
  }
  [System.Windows.Forms.MessageBox]::Show(
    "A claude window will open.`n`n" +
    "Log in there, then type /mcp to connect the connectors the jobs need:`n" +
    "Gmail (sending email) and push notifications.`n`n" +
    "Close that window when done, then press button 3 to test.",
    "Step 2", "OK", "Information") | Out-Null
  Start-Process "cmd.exe" -ArgumentList "/k", "cd /d `"$Root`" && claude"
} | Out-Null

AddButton $g3 "3. Send test email" 434 28 200 {
  # Same flags the real jobs use (see tasks/run.cmd), otherwise the test hits a
  # permission prompt nobody is there to approve and silently does nothing.
  RunNeedsClaude "Send test email" "claude -p --dangerously-skip-permissions `"Send a test email with subject 'Gold Watch system test' to iminiwindy@gmail.com and pongkasame.oil@gmail.com. Body: one short line confirming the Gold Watch automation can send mail from this machine.`""
} | Out-Null

# -- status ----------------------------------------------------------------
function RefreshStatus {
  $hasNode = [bool](Get-Command node -ErrorAction SilentlyContinue)
  $hasCli  = HasClaude
  $names = @("GoldWatch-Morning","GoldWatch-Scan-1000","GoldWatch-Scan-1500","GoldWatch-Scan-2000","GoldWatch-Review")
  # Get-ScheduledTask is a cmdlet, so it has no native-stderr pitfall
  $n = 0
  foreach ($t in $names) {
    if (Get-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue) { $n++ }
  }
  $parts = @()
  $parts += if ($hasNode) { "Node OK" } else { "Node not found" }
  $parts += if ($hasCli)  { "Claude CLI OK" } else { "Claude CLI missing (press button 1)" }
  $parts += "Scheduled jobs installed: $n / 5"
  $status.Text = "Folder: $Root`r`n" + ($parts -join "   -   ")
  $status.ForeColor = if ($hasNode -and $hasCli -and $n -eq 5) {
    [System.Drawing.Color]::FromArgb(26, 112, 72)
  } else {
    [System.Drawing.Color]::FromArgb(138, 90, 18)
  }
}

RefreshStatus
Log "Ready."
Log ""
if (-not (HasClaude)) {
  Log "Claude Code CLI is not installed yet."
  Log "The 'Scheduled jobs' buttons stay unavailable until setup steps 1 -> 2 -> 3 are done."
  Log "The 'Everyday' buttons work right now -- no setup needed."
} else {
  Log "Claude Code CLI detected. If the schedule is not installed yet, press 'Install schedule'."
}

[void]$form.ShowDialog()
