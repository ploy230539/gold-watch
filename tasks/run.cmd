@echo off
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
exit /b %RC%
