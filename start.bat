@echo off
chcp 936 >nul
title Sleep Care - Start

echo ========================================
echo   Sleep Care System - Starting
echo ========================================
echo.

cd /d "%~dp0"

echo [1/2] Starting backend server (http://localhost:3000) ...
start "Backend" cmd /k "cd backend && npm run dev"
timeout /t 3 /nobreak >nul

echo [2/2] Starting mini-program preview...
start "Preview" cmd /k "node "c:\Users\yzj18\.trae-cn\builtin_skills\TRAE-generate-mini-app\scripts\preview-server.js" "%~dp0miniprogram""
timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo   All services started!
echo   Backend:    http://localhost:3000
echo   Preview:    https://trae.mobile.volcapp.com/preview/?ws=ws://localhost:65012
echo ========================================
echo.
echo Press any key to open preview in browser...
pause >nul

start https://trae.mobile.volcapp.com/preview/?ws=ws://localhost:65012

exit
