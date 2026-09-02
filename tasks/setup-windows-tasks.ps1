# Register the Gold Watch jobs in Windows Task Scheduler.
# Run once from PowerShell (no admin rights needed for per-user tasks):
#
#   powershell -ExecutionPolicy Bypass -File tasks\setup-windows-tasks.ps1
#
# Two things must be done first (see PROMPTS.md):
#   1) npm install -g @anthropic-ai/claude-code
#   2) open `claude` interactively once, log in, and connect the Gmail and
#      push-notification connectors -- otherwise the jobs run but cannot send email.

$ErrorActionPreference = "Stop"

if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
  Write-Error "Claude Code CLI not found. Run: npm install -g @anthropic-ai/claude-code"
}

$run = Join-Path $PSScriptRoot "run.cmd"
if (-not (Test-Path $run)) { Write-Error "Not found: $run" }

# schtasks supports MONTHLY /D 1 directly; New-ScheduledTaskTrigger cannot express
# "the 1st of every month", which is why this uses schtasks instead.
$jobs = @(
  @{ Name = "GoldWatch-Morning";   Prompt = "morning.md"; Sc = @("/SC","WEEKLY","/D","MON,TUE,WED,THU,FRI,SAT","/ST","08:00")
     Desc = "Morning gold brief, 08:00 Mon-Sat" }
  @{ Name = "GoldWatch-Scan-1000"; Prompt = "watch.md";   Sc = @("/SC","WEEKLY","/D","MON,TUE,WED,THU,FRI","/ST","10:00")
     Desc = "Gold price scan, 10:00 Mon-Fri" }
  @{ Name = "GoldWatch-Scan-1500"; Prompt = "watch.md";   Sc = @("/SC","WEEKLY","/D","MON,TUE,WED,THU,FRI","/ST","15:00")
     Desc = "Gold price scan, 15:00 Mon-Fri" }
  @{ Name = "GoldWatch-Scan-2000"; Prompt = "watch.md";   Sc = @("/SC","WEEKLY","/D","MON,TUE,WED,THU,FRI","/ST","20:00")
     Desc = "Gold price scan, 20:00 Mon-Fri" }
  @{ Name = "GoldWatch-Review";    Prompt = "review.md";  Sc = @("/SC","MONTHLY","/D","1","/ST","09:00")
     Desc = "Monthly self review, 09:00 on the 1st" }
)

# /F already overwrites an existing task, so there is no pre-delete step. Redirecting
# a native exe's stderr in PowerShell 5.1 turns plain output into NativeCommandError,
# which $ErrorActionPreference = "Stop" then treats as fatal -- so never do it here.
foreach ($j in $jobs) {
  $tr = '"' + $run + '" ' + $j.Prompt
  $argv = @("/Create","/TN",$j.Name,"/TR",$tr) + $j.Sc + @("/F","/RL","LIMITED")

  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  & schtasks @argv | Out-Null
  $rc = $LASTEXITCODE
  $ErrorActionPreference = $prev

  if ($rc -ne 0) { Write-Error "Failed to register $($j.Name) (schtasks exit $rc)" }
  Write-Host "Registered: $($j.Name) -- $($j.Desc)"
}

Write-Host ""
Write-Host "Jobs only fire while the machine is on. A missed slot is skipped, not caught up."
Write-Host "Per-run logs are written to logs\ in the project folder."
Write-Host ""
Write-Host "List a job:  schtasks /Query /TN GoldWatch-Morning"
Write-Host "Run now:     schtasks /Run /TN GoldWatch-Morning"
Write-Host "Remove:      schtasks /Delete /TN GoldWatch-Morning /F"
