@echo off
title Pulau Nusantara - Server Lokal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [X] Node.js tidak ditemukan. Pasang dulu dari https://nodejs.org
  echo     Tanpa server: dobel-klik index.html saja ^(grafik sederhana^).
  echo.
  pause
  exit /b 1
)

echo ================================================
echo    PULAU NUSANTARA - menyalakan server lokal
echo    Alamat: http://localhost:8317/
echo    Biarkan jendela ini terbuka selama bermain.
echo ================================================
echo.

rem Buka browser 2 detik setelah server dinyalakan
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:8317/'"

node server.js
pause
