@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node is not installed. Get the LTS version from https://nodejs.org , install it, then double-click this again.
  pause
  exit /b 1
)
node scripts\start.mjs
pause
