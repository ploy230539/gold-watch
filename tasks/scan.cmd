@echo off
setlocal
REM Token-free price scan. Fetches live prices and applies the thresholds in pure
REM code; the language model is invoked ONLY when an alert is actually warranted,
REM which is the rare case. Usage: scan.cmd
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
  echo Claude CLI not found >> "logs\watch.log"
  node gw.mjs health --record-send fail --detail "Claude CLI not found on PATH" >nul 2>&1
  exit /b 9
)
echo. >> "logs\watch.log"
echo [%DATE% %TIME%] scan start >> "logs\watch.log"

node gw.mjs scan > "logs\scan.json" 2>> "logs\watch.log"
set "RC=%ERRORLEVEL%"
type "logs\scan.json" >> "logs\watch.log"

if "%RC%"=="0" (
  echo [%DATE% %TIME%] below threshold - silent, no model used >> "logs\watch.log"
  echo Below threshold. Nothing sent, no model used.
  exit /b 0
)
if not "%RC%"=="10" (
  echo [%DATE% %TIME%] scan failed rc=%RC% >> "logs\watch.log"
  echo Scan failed with code %RC% - see logs\watch.log
  exit /b %RC%
)

echo [%DATE% %TIME%] threshold hit - handing over to the model >> "logs\watch.log"
echo Threshold hit. Composing and sending the alert...
type "tasks\watch.md" | "%CLAUDE%" -p --dangerously-skip-permissions >> "logs\watch.log" 2>&1
set "RC=%ERRORLEVEL%"
echo [%DATE% %TIME%] alert run exit=%RC% >> "logs\watch.log"

REM Record whether anything actually reached her. A scan that fetches prices
REM perfectly and then fails to deliver is still a scan that told her nothing.
if "%RC%"=="0" (
  node gw.mjs health --record-send ok >nul 2>&1
) else (
  node gw.mjs health --record-send fail --from-log "logs\watch.log" --detail "alert run exit=%RC%" >nul 2>&1
)
exit /b %RC%
