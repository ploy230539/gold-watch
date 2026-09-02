@echo off
REM Token-free price scan. Fetches live prices and applies the thresholds in pure
REM code; the language model is invoked ONLY when an alert is actually warranted,
REM which is the rare case. Usage: scan.cmd
setlocal
cd /d "%~dp0.."
if not exist "logs" mkdir logs
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
type "tasks\watch.md" | claude -p --dangerously-skip-permissions >> "logs\watch.log" 2>&1
set "RC=%ERRORLEVEL%"
echo [%DATE% %TIME%] alert run exit=%RC% >> "logs\watch.log"
exit /b %RC%
