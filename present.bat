@echo off
setlocal enabledelayedexpansion

echo.
echo  ======================================================
echo     AquaBill AI - Presentation Mode (One-Click Setup)
echo  ======================================================
echo.

REM Refresh PATH so ngrok is found after recent install
set "PATH=%PATH%;%LOCALAPPDATA%\Microsoft\WinGet\Links;%LOCALAPPDATA%\ngrok"

REM ── Step 1: Start Redis ──────────────────────────────────
echo [1/6] Starting Redis...
start /min "Redis Server" cmd /k "C:\Users\kalth\redis\redis-server.exe"
timeout /t 2 /nobreak >nul

REM ── Step 2: Start Django Backend ─────────────────────────
echo [2/6] Starting Django Backend...
start /min "Django Server" cmd /k "cd backend && call venv\Scripts\activate.bat && python manage.py runserver 0.0.0.0:8000"
timeout /t 3 /nobreak >nul

REM ── Step 3: Start Celery Worker ──────────────────────────
echo [3/6] Starting Celery Worker...
start /min "Celery Worker" cmd /k "cd backend && call venv\Scripts\activate.bat && celery -A config worker -l info --pool=solo"
timeout /t 2 /nobreak >nul

REM ── Step 4: Start Ngrok Tunnels ──────────────────────────
echo [4/6] Starting ngrok tunnels (backend + frontend)...
start /min "Ngrok Tunnels" cmd /k "ngrok start --all --config ngrok.yml"
echo     Waiting for ngrok to initialize...
timeout /t 6 /nobreak >nul

REM ── Step 5: Auto-detect ngrok URLs and update frontend ───
echo [5/6] Detecting ngrok URLs and configuring frontend...

REM Query ngrok local API to get tunnel URLs
set BACKEND_URL=
set FRONTEND_URL=

REM Use PowerShell to query ngrok API and extract URLs
for /f "delims=" %%i in ('powershell -Command "try { $r = Invoke-RestMethod http://localhost:4040/api/tunnels; $r.tunnels | ForEach-Object { if ($_.config.addr -match '8000') { Write-Output $_.public_url } } } catch { Write-Output 'ERROR' }"') do set BACKEND_URL=%%i

for /f "delims=" %%i in ('powershell -Command "try { $r = Invoke-RestMethod http://localhost:4040/api/tunnels; $r.tunnels | ForEach-Object { if ($_.config.addr -match '3000') { Write-Output $_.public_url } } } catch { Write-Output 'ERROR' }"') do set FRONTEND_URL=%%i

if "!BACKEND_URL!"=="ERROR" (
    echo.
    echo  [ERROR] Could not connect to ngrok. Make sure:
    echo     1. You ran: ngrok config add-authtoken YOUR_TOKEN
    echo     2. Ngrok is properly installed
    echo.
    pause
    exit /b 1
)

if "!BACKEND_URL!"=="" (
    echo.
    echo  [WARNING] Could not detect backend URL. Ngrok free tier
    echo  may only allow 1 tunnel. Trying backend-only tunnel...
    
    REM Kill the multi-tunnel ngrok and start single tunnel
    taskkill /fi "WINDOWTITLE eq Ngrok Tunnels" /f >nul 2>&1
    timeout /t 2 /nobreak >nul
    start /min "Ngrok Tunnels" cmd /k "ngrok http 8000"
    timeout /t 5 /nobreak >nul
    
    for /f "delims=" %%i in ('powershell -Command "try { $r = Invoke-RestMethod http://localhost:4040/api/tunnels; $r.tunnels[0].public_url } catch { Write-Output 'ERROR' }"') do set BACKEND_URL=%%i
    
    set FRONTEND_URL=http://localhost:3000
    echo  Backend tunnel: !BACKEND_URL!
    echo  Frontend: Open localhost:3000 on this laptop
    echo.
)

REM Write the backend URL to frontend .env.local
echo REACT_APP_API_URL=!BACKEND_URL!> frontend\.env.local

echo     Backend URL : !BACKEND_URL!
echo     Frontend URL: !FRONTEND_URL!
echo.

REM ── Step 6: Start React Frontend (with updated API URL) ──
echo [6/6] Starting React frontend with tunneled API...
start "React Frontend" cmd /k "cd frontend && set REACT_APP_API_URL=!BACKEND_URL! && npm start"

echo.
echo  ======================================================
echo   ALL DONE! Your app is live!
echo  ======================================================
echo.
echo   Share this link with your audience:
echo.
echo      !FRONTEND_URL!
echo.
echo   Backend API is at:
echo      !BACKEND_URL!
echo.
echo   Ngrok Dashboard (see all tunnels):
echo      http://localhost:4040
echo.
echo   NOTE: When someone opens the ngrok link for the first
echo   time, they may see an ngrok warning page. They just
echo   need to click "Visit Site" to proceed.
echo  ======================================================
echo.
pause
