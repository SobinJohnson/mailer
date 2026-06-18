#!/bin/bash
# ============================================================
#  Mailer CRM — One-Click Self-Hosted Setup (Linux/macOS)
# ============================================================
#  Prerequisites: Docker and Docker Compose must be installed.
#  Usage: chmod +x setup.sh && ./setup.sh
# ============================================================

set -e

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   Mailer CRM — Self-Hosted Setup             ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "[ERROR] Docker is not installed."
    echo "Install it from: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check Docker is running
if ! docker info &> /dev/null; then
    echo "[ERROR] Docker is installed but not running."
    echo "Please start Docker and try again."
    exit 1
fi

echo "[OK] Docker is installed and running."
echo ""

# Navigate to script directory
cd "$(dirname "$0")"

# Copy .env if not exists
if [ ! -f ".env" ]; then
    echo "[SETUP] Creating .env from .env.example..."
    cp .env.example .env
    echo "[OK] .env created. Edit docker/.env to customize passwords."
else
    echo "[OK] .env already exists."
fi

echo ""
echo "[STARTING] Pulling images and starting containers..."
echo "(This may take a few minutes on first run)"
echo ""

docker compose up -d

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║                  SETUP COMPLETE!                     ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║                                                      ║"
echo "║  Services running:                                   ║"
echo "║    PostgreSQL   → localhost:5432                      ║"
echo "║    Supabase API → http://localhost:8000               ║"
echo "║                                                      ║"
echo "║  Add these to your .env.local:                       ║"
echo "║                                                      ║"
echo "║  NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000       ║"
echo "║  NEXT_PUBLIC_SUPABASE_ANON_KEY=<see docker/.env>     ║"
echo "║  SUPABASE_SERVICE_KEY=<see docker/.env>              ║"
echo "║                                                      ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
