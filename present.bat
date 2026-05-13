@echo off
setlocal enabledelayedexpansion

echo.
echo  ======================================================
echo     AquaBill AI - Presentation Mode (One-Click Setup)
echo  ======================================================
echo.

REM Refresh PATH so ngrok is found after install
set "PATH=%PATH%;%LOCALAPPDATA%\Microsoft\WinGet\Links;%LOCALAPPDATA%\ngrok"

REM ── Step 1: Start Redis ──────────────────────────────────
echo [1/7] Starting Redis...
start /min "Redis Server" cmd /c "C:\Users\kalth\redis\redis-server.exe"
timeout /t 2 /nobreak >nul

REM ── Step 2: Start Django Backend ─────────────────────────
echo [2/7] Starting Django Backend (port 8000)...
start "Django Server" /min cmd /c "cd backend && call venv\Scripts\activate.bat && python manage.py runserver 0.0.0.0:8000"
timeout /t 3 /nobreak >nul

REM ── Step 3: Start Celery Worker ──────────────────────────
echo [3/7] Starting Celery Worker...
start "Celery Worker" /min cmd /c "cd backend && call venv\Scripts\activate.bat && celery -A config worker -l info --pool=solo"
timeout /t 2 /nobreak >nul

REM ── Step 4: Start Ngrok Tunnel for Backend ───────────────
echo [4/7] Starting ngrok tunnel for backend...
start "Ngrok Backend" cmd /c "ngrok http 8000"
echo     Waiting for ngrok to initialize...
timeout /t 8 /nobreak >nul

REM ── Step 5: Auto-detect backend ngrok URL ────────────────
echo [5/7] Detecting backend ngrok URL...

set BACKEND_URL=
for /f "delims=" %%i in ('powershell -Command "try { $r = Invoke-RestMethod http://localhost:4040/api/tunnels; $r.tunnels[0].public_url } catch { Write-Output 'ERROR' }"') do set BACKEND_URL=%%i

if "!BACKEND_URL!"=="ERROR" (
    echo.
    echo  [ERROR] Could not connect to ngrok!
    echo  Make sure you ran: ngrok config add-authtoken YOUR_TOKEN
    echo  And that ngrok is updated: ngrok update
    pause
    exit /b 1
)

echo     Backend URL: !BACKEND_URL!

REM Write backend URL to frontend .env.local
echo REACT_APP_API_URL=!BACKEND_URL!> frontend\.env.local

REM ── Step 6: Start React Frontend ─────────────────────────
echo [6/7] Starting React frontend (port 3000)...
start "React Frontend" cmd /c "cd frontend && set REACT_APP_API_URL=!BACKEND_URL! && npm start"
echo     Waiting for React to compile...
timeout /t 15 /nobreak >nul

REM ── Step 7: Start LocalTunnel for Frontend ───────────────
echo [7/7] Starting public tunnel for frontend...
start "Frontend Tunnel" cmd /c "npx -y localtunnel --port 3000"
timeout /t 8 /nobreak >nul

echo.
echo  ======================================================
echo   ALL DONE! Your app is live for presentation!
echo  ======================================================
echo.
echo   BACKEND API (ngrok):
echo      !BACKEND_URL!
echo.
echo   FRONTEND (localtunnel):
echo      Check the "Frontend Tunnel" window for your URL
echo      It will look like: https://xxxx.loca.lt
echo.
echo   SHARE THE FRONTEND URL WITH YOUR AUDIENCE!
echo.
echo   NOTE: First-time visitors will see a confirmation page.
echo   They just click "Click to Continue" once.
echo.
echo   Ngrok Dashboard: http://localhost:4040
echo  ======================================================
echo.
pause
