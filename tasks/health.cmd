@echo off
REM Watcher health check. Pure code, zero model usage while healthy: exits
REM immediately when scans are running normally, and only escalates to the model
REM when the watcher has gone quiet for too long -- because silence must not be
REM mistaken for "gold did not move".
setlocal
cd /d "%~dp0.."
if not exist "logs" mkdir logs
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

echo [%DATE% %TIME%] STALE - warning the owner >> "logs\health.log"
echo Watcher is stale. Sending a warning...
type "tasks\health-alert.md" | claude -p --dangerously-skip-permissions >> "logs\health.log" 2>&1
echo [%DATE% %TIME%] warning run exit=%ERRORLEVEL% >> "logs\health.log"
exit /b 0
