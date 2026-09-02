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

foreach ($f in @("run.cmd", "scan.cmd", "health.cmd")) {
  if (-not (Test-Path (Join-Path $PSScriptRoot $f))) { Write-Error "Not found: $f" }
}

# schtasks supports MONTHLY /D 1 directly; New-ScheduledTaskTrigger cannot express
# "the 1st of every month", which is why this uses schtasks instead.
# The scan jobs call scan.cmd, which decides in pure code and only starts a model
# when an alert is actually warranted. The morning job always needs the model.
$jobs = @(
  @{ Name = "GoldWatch-Morning";   Runner = "run.cmd";  Prompt = "morning.md"
     Sc = @("/SC","WEEKLY","/D","MON,TUE,WED,THU,FRI,SAT","/ST","08:00")
     Desc = "Morning gold brief, 08:00 Mon-Sat" }

  # The scan is pure code and free, so it runs every 30 minutes through the Thai
  # trading day instead of three times. The association re-announces 10-20 times a
  # day; three checks was leaving hours unwatched. A model only starts on the runs
  # that actually cross a threshold.
  @{ Name = "GoldWatch-Scan";      Runner = "scan.cmd"; Prompt = ""
     Sc = @("/SC","WEEKLY","/D","MON,TUE,WED,THU,FRI,SAT","/ST","08:30","/RI","30","/DU","13:30","/K")
     Desc = "Gold price scan every 30 min, 08:30-22:00 Mon-Sat" }

  # Silence must never be ambiguous: this checks that the scans are actually running
  # and speaks up if they are not. Costs nothing while healthy.
  @{ Name = "GoldWatch-Health";    Runner = "health.cmd"; Prompt = ""
     Sc = @("/SC","DAILY","/ST","12:07")
     Desc = "Watcher health check, 12:07 daily" }

  @{ Name = "GoldWatch-Review";    Runner = "run.cmd";  Prompt = "review.md"
     Sc = @("/SC","MONTHLY","/D","1","/ST","09:00")
     Desc = "Monthly self review, 09:00 on the 1st" }
)

# /F already overwrites an existing task, so there is no pre-delete step. Redirecting
# a native exe's stderr in PowerShell 5.1 turns plain output into NativeCommandError,
# which $ErrorActionPreference = "Stop" then treats as fatal -- so never do it here.
foreach ($j in $jobs) {
  $runner = Join-Path $PSScriptRoot $j.Runner
  $tr = '"' + $runner + '"'
  if ($j.Prompt) { $tr += ' ' + $j.Prompt }
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
Write-Host "List a job:  schtasks /Query /TN GoldWatch-Scan"
Write-Host "Run now:     schtasks /Run /TN GoldWatch-Morning"
Write-Host "Remove:      schtasks /Delete /TN GoldWatch-Morning /F"
