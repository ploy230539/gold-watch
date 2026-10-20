@echo off
REM Watcher health check. Pure code, zero model usage while healthy: exits
REM immediately when scans are running normally, and only escalates to the model
REM when the watcher has gone quiet for too long -- because silence must not be
REM mistaken for "gold did not move".
setlocal
cd /d "%~dp0.."
if not exist "logs" mkdir logs
REM Resolve claude by full path. A window opened before the PATH changed keeps the
REM old one, so "claude" can be missing here while it works everywhere else - which
REM looked exactly like a broken install.
set "CLAUDE="
for /f "delims=" %%I in ('where claude.cmd 2^>nul') do if not defined CLAUDE set "CLAUDE=%%I"
if not defined CLAUDE if exist "%APPDATA%\npm\claude.cmd" set "CLAUDE=%APPDATA%\npm\claude.cmd"
if not defined CLAUDE if exist "%LOCALAPPDATA%\Programs\claude\claude.exe" set "CLAUDE=%LOCALAPPDATA%\Programs\claude\claude.exe"
if not defined CLAUDE (
  echo Claude CLI not found. Press "1. Install Claude CLI" in the Gold Watch panel.
  echo Claude CLI not found >> "logs\health.log"
  node gw.mjs health --record-send fail --detail "Claude CLI not found on PATH" >nul 2>&1
  exit /b 9
)
echo. >> "logs\health.log"
echo [%DATE% %TIME%] health check >> "logs\health.log"

node gw.mjs health --pretty >> "logs\health.log" 2>&1
set "RC=%ERRORLEVEL%"

if "%RC%"=="0" (
  echo [%DATE% %TIME%] healthy - nothing to do, no model used >> "logs\health.log"
  echo Watcher healthy. Nothing sent, no model used.
  exit /b 0
)
if not "%RC%"=="11" (
  echo [%DATE% %TIME%] health command itself failed rc=%RC% >> "logs\health.log"
  exit /b %RC%
)

echo [%DATE% %TIME%] UNHEALTHY - warning the owner >> "logs\health.log"
echo Watcher is unhealthy. Sending a warning...

REM Push FIRST, with plain code. The usual failure is the model losing its login,
REM and a warning that needs the model to say "the model is broken" never arrives.
node gw.mjs notify --title "Gold Watch ต้องการให้ตรวจสอบ" --message "ระบบแจ้งเตือนมีปัญหา เปิด Gold Watch แล้วกด Is it still watching? เพื่อดูรายละเอียด" --priority 5 --tags warning >> "logs\health.log" 2>&1

REM The detailed email is a bonus: nice when the model works, never relied upon.
type "tasks\health-alert.md" | "%CLAUDE%" -p --dangerously-skip-permissions >> "logs\health.log" 2>&1
echo [%DATE% %TIME%] warning run exit=%ERRORLEVEL% >> "logs\health.log"
exit /b 0
