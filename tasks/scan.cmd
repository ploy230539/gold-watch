@echo off
setlocal
REM Price scan - pure code, no model, no tokens. Fetches live prices, applies the
REM thresholds, and sends the phone push itself when one trips. Since email was
REM switched off (17 Nov 2026) there is nothing left for a model to do here.
REM Usage: scan.cmd
REM Keep this file ASCII: cmd.exe reads it as code page 874 and mangles Thai.
cd /d "%~dp0.."
if not exist "logs" mkdir logs

echo. >> "logs\watch.log"
echo [%DATE% %TIME%] scan start >> "logs\watch.log"

node gw.mjs scan > "logs\scan.json" 2>> "logs\watch.log"
set "RC=%ERRORLEVEL%"
type "logs\scan.json" >> "logs\watch.log"

if "%RC%"=="0" (
  echo [%DATE% %TIME%] below threshold - silent >> "logs\watch.log"
  echo Below threshold. Nothing sent.
  exit /b 0
)
if "%RC%"=="10" (
  echo [%DATE% %TIME%] alert - pushed to the phone >> "logs\watch.log"
  echo Threshold hit. Push sent - see push_sent in logs\scan.json.
  exit /b 0
)
echo [%DATE% %TIME%] scan failed rc=%RC% >> "logs\watch.log"
echo Scan failed with code %RC% - see logs\watch.log
exit /b %RC%
