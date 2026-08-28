@echo off
REM ตัวรันงาน Gold Watch — ใช้: run.cmd <ชื่อไฟล์ prompt>
REM เช่น  run.cmd morning.md
setlocal
cd /d "%~dp0.."
if "%~1"=="" (echo ต้องระบุไฟล์ prompt เช่น run.cmd morning.md & exit /b 1)
if not exist "tasks\%~1" (echo ไม่พบไฟล์ tasks\%~1 & exit /b 1)
if not exist "logs" mkdir logs
set "TS=%DATE:/=-%_%TIME::=-%"
set "TS=%TS: =0%"
REM prompt เป็นไฟล์ในเครื่องที่เขียนไว้ตายตัว ไม่ได้รับ input จากภายนอก
type "tasks\%~1" | claude -p --dangerously-skip-permissions >> "logs\%~n1.log" 2>&1
echo [%TS%] %~1 exit=%ERRORLEVEL% >> "logs\%~n1.log"
exit /b %ERRORLEVEL%
