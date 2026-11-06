@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0update-page.ps1"
echo.
echo If the window says "startup file saved" you can close it.
pause
