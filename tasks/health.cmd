@echo off
REM Watcher health check. Pure code, no model: silent while healthy, and a phone
REM push when the watcher has gone quiet or deliveries are failing - because
REM silence must not be mistaken for "gold did not move".
REM Keep this file ASCII: cmd.exe reads it as code page 874 and mangles Thai. The
REM Thai text of the warning lives in gw.mjs (notify --preset health).
setlocal
cd /d "%~dp0.."
if not exist "logs" mkdir logs
echo. >> "logs\health.log"
echo [%DATE% %TIME%] health check >> "logs\health.log"

node gw.mjs health --pretty >> "logs\health.log" 2>&1
set "RC=%ERRORLEVEL%"

if "%RC%"=="0" (
  echo [%DATE% %TIME%] healthy - nothing to do >> "logs\health.log"
  echo Watcher healthy. Nothing sent.
  exit /b 0
)
if not "%RC%"=="11" (
  echo [%DATE% %TIME%] health command itself failed rc=%RC% >> "logs\health.log"
  exit /b %RC%
)

echo [%DATE% %TIME%] UNHEALTHY - pushing a warning >> "logs\health.log"
echo Watcher is unhealthy. Sending a warning...
node gw.mjs notify --preset health >> "logs\health.log" 2>&1
exit /b 0
