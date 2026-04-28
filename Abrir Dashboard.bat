@echo off
title Marketing Dashboard

:: Kill any process already on port 3000
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3000 " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)

echo Iniciando Marketing Dashboard...
cd /d "C:\Users\franc\marketing-dashboard"

:: Start the dev server in background
start "Next.js Server" /min cmd /c "node_modules\.bin\next dev 2>&1"

:: Wait for server to be ready
echo Esperando que el servidor arranque...
:wait
timeout /t 2 /nobreak >nul
curl -s http://localhost:3000 >nul 2>&1
if errorlevel 1 goto wait

:: Open browser
start "" "http://localhost:3000"
exit
