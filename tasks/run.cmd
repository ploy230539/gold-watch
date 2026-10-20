@echo off
setlocal
REM Gold Watch task runner -- usage: run.cmd <prompt-file>
REM example: run.cmd morning.md
setlocal
cd /d "%~dp0.."
if "%~1"=="" (echo Missing prompt file. Usage: run.cmd morning.md & exit /b 1)
if not exist "tasks\%~1" (echo Prompt file not found: tasks\%~1 & exit /b 1)
if not exist "logs" mkdir logs
REM The prompt is a fixed local file. It takes no external input.
type "tasks\%~1" | claude -p --dangerously-skip-permissions >> "logs\%~n1.log" 2>&1
set "RC=%ERRORLEVEL%"
echo [%DATE% %TIME%] %~1 exit=%RC% >> "logs\%~n1.log"

REM The morning brief is the main thing she reads, so a failure here has to be
REM recorded. Reviews are internal; only the brief counts as a delivery.
if /I "%~1"=="morning.md" (
  if "%RC%"=="0" (
    node gw.mjs health --record-send ok >nul 2>&1
  ) else (
    node gw.mjs health --record-send fail --from-log "logs\morning.log" --detail "morning exit=%RC%" >nul 2>&1
  )
)
exit /b %RC%
