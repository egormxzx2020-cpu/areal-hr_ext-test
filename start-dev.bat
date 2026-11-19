@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ======================================================
echo   Запуск Areal HR (PostgreSQL, NestJS API, Quasar UI)
echo ======================================================
echo.

:: 1. Проверка и старт базы данных в Docker
echo [1/3] Запуск базы данных PostgreSQL...
docker compose up -d
if errorlevel 1 (
    echo.
    echo [ОШИБКА] Не удалось запустить Docker Compose!
    echo Проверьте, что приложение Docker Desktop запущено.
    echo.
    pause
    exit /b 1
)

:: 2. Старт Backend (NestJS)
echo [2/3] Запуск Backend API (порт 3000)...
start "Areal HR - Backend API" /D "%~dp0api" cmd /k "npm run start:dev"

:: 3. Старт Frontend (Quasar)
echo [3/3] Запуск Frontend UI (порт 9000)...
start "Areal HR - Frontend UI" /D "%~dp0app" cmd /k "npm run dev"

echo.
echo ======================================================
echo Все службы запущены в отдельных окнах:
echo - Backend API:  http://localhost:3000
echo - Frontend UI:  http://localhost:9000
echo ======================================================
echo.
pause