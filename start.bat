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

echo [2/2] Starting mini-program build (weapp)...
start "MiniProgram" cmd /k "cd miniprogram && npm run dev:weapp"
timeout /t 10 /nobreak >nul

echo.
echo ========================================
echo   All services started!
echo   Backend:       http://localhost:3000
echo   MiniProgram:   %~dp0miniprogram\dist
echo ========================================
echo.

echo Next steps:
echo   1. Open WeChat Developer Tools
echo   2. Import project from: %~dp0miniprogram\dist
echo   3. In Details -^> Local Settings, check "Skip domain validation"
echo.

echo Press any key to exit this window...
pause >nul

exit

