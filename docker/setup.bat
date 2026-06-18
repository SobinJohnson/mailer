@echo off
REM ============================================================
REM  Mailer CRM — One-Click Self-Hosted Setup (Windows)
REM ============================================================
REM  Prerequisites: Docker Desktop must be installed and running.
REM  This script will:
REM    1. Copy the example .env if you don't have one
REM    2. Start all containers (Postgres, Auth, API Gateway)
REM    3. Print the connection details for your .env.local
REM ============================================================

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║   Mailer CRM — Self-Hosted Setup             ║
echo  ╚══════════════════════════════════════════════╝
echo.

REM Check Docker
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Docker is not installed or not in PATH.
    echo  Please install Docker Desktop from: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

REM Check Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Docker is installed but not running.
    echo  Please start Docker Desktop and try again.
    pause
    exit /b 1
)

echo  [OK] Docker is installed and running.
echo.

REM Navigate to docker directory
cd /d "%~dp0"

REM Copy .env if not exists
if not exist ".env" (
    echo  [SETUP] Creating .env from .env.example...
    copy .env.example .env >nul
    echo  [OK] .env created. Edit docker\.env to customize passwords.
) else (
    echo  [OK] .env already exists.
)

echo.
echo  [STARTING] Pulling images and starting containers...
echo  (This may take a few minutes on first run)
echo.

docker compose up -d

if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Failed to start containers. Check Docker logs:
    echo    docker compose logs
    pause
    exit /b 1
)

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║                  SETUP COMPLETE!                     ║
echo  ╠══════════════════════════════════════════════════════╣
echo  ║                                                      ║
echo  ║  Services running:                                   ║
echo  ║    PostgreSQL   → localhost:5432                      ║
echo  ║    Supabase API → http://localhost:8000               ║
echo  ║                                                      ║
echo  ║  Add these to your .env.local:                       ║
echo  ║                                                      ║
echo  ║  NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000       ║
echo  ║  NEXT_PUBLIC_SUPABASE_ANON_KEY=<see docker/.env>     ║
echo  ║  SUPABASE_SERVICE_KEY=<see docker/.env>              ║
echo  ║                                                      ║
echo  ╚══════════════════════════════════════════════════════╝
echo.
pause
