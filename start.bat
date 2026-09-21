@echo off
title World Time Buddy Launcher
cd /d "%~dp0"

echo ===================================================
echo   Starting World Time Buddy (Edge + Python Server)
echo ===================================================
echo.
echo Opening http://localhost:8080 in Microsoft Edge...
echo (You can also install it as a Windows app via Edge menu: Apps -^> Install this site as an app)
echo.

start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" "http://localhost:8080"
"C:\ProgramData\anaconda3\python.exe" -m http.server 8080
