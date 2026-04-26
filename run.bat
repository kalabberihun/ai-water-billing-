@echo off
echo Starting AI Water Billing System...

REM Start Redis
start "Redis Server" cmd /k "C:\Users\kalth\redis\redis-server.exe"

REM Start Django Backend
start "Django Server" cmd /k "cd backend && call venv\Scripts\activate.bat && python manage.py runserver"

REM Start Celery Worker
start "Celery Worker" cmd /k "cd backend && call venv\Scripts\activate.bat && celery -A config worker -l info --pool=solo"

REM Start React Frontend
start "React Frontend" cmd /k "cd frontend && npm start"

echo All services started in separate windows!
