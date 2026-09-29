@echo off
setlocal enabledelayedexpansion
title World Time Tool - Local LAN Server

set "PORT=8000"
set "PY=C:\ProgramData\anaconda3\python.exe"
if not exist "%PY%" set "PY=python"

rem Serve this script's own folder
set "DIR=%~dp0"
set "DIR=%DIR:~0,-1%"

rem Pick the LAN IPv4 address (prefer active routed adapter)
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command ^
 "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.PrefixOrigin -ne 'WellKnown' } | Sort-Object InterfaceMetric | Select-Object -First 1).IPAddress"`) do set "IP=%%i"
if "!IP!"=="" set "IP=127.0.0.1"

echo.
echo   =============================================
echo     World Time Tool - Local Test Server
echo   =============================================
echo.
echo   Serving directory: %DIR%
echo.
echo   This PC:   http://localhost:%PORT%
echo   Phone:     http://!IP!:%PORT%
echo.
echo   Phone must be connected to the same Wi-Fi network.
echo   Press Ctrl+C to stop the server.
echo.

"%PY%" -m http.server %PORT% --bind 0.0.0.0 --directory "%DIR%"
