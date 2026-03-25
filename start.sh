#!/bin/bash
# EyeTui Docker Startup Script (Bash)
# Ensures required files exist before starting containers

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE="${1:-local}"  # Options: local (HTTP), ghcr (HTTPS), build, prod
ACTION="${2:-up}"   # Options: up, down, pull

# Ensure required files exist (prevents Docker from creating directories)
declare -A REQUIRED_FILES=(
    ["backend/learned_rules.json"]="{}"
)

for file in "${!REQUIRED_FILES[@]}"; do
    full_path="$SCRIPT_DIR/$file"
    content="${REQUIRED_FILES[$file]}"
    
    # Check if it's a directory (Docker error) and remove it
    if [ -d "$full_path" ]; then
        echo "[FIX] Removing directory that should be a file: $file"
        rm -rf "$full_path"
    fi
    
    # Create file if it doesn't exist
    if [ ! -f "$full_path" ]; then
        echo "[CREATE] Creating missing file: $file"
        mkdir -p "$(dirname "$full_path")"
        echo -n "$content" > "$full_path"
    fi
done

# Build docker-compose command
case "$MODE" in
    "local")
        COMPOSE_FILES="-f docker-compose.yml -f docker-compose.local.yml"
        ;;
    "ghcr")
        COMPOSE_FILES="-f docker-compose.yml -f docker-compose.ghcr.yml"
        ;;
    "build")
        COMPOSE_FILES="-f docker-compose.yml"
        ;;
    "prod")
        COMPOSE_FILES="-f docker-compose.prod.yml"
        ;;
    *)
        COMPOSE_FILES="-f docker-compose.yml -f docker-compose.local.yml"
        ;;
esac

cd "$SCRIPT_DIR"

case "$ACTION" in
    "down")
        echo ""
        echo "[STOP] Stopping containers..."
        docker-compose $COMPOSE_FILES down
        ;;
    "pull")
        echo ""
        echo "[PULL] Pulling latest images..."
        docker-compose $COMPOSE_FILES pull
        echo ""
        echo "[START] Starting containers (mode: $MODE)..."
        docker-compose $COMPOSE_FILES up -d
        
        echo ""
        echo "[WAIT] Waiting for backend to be healthy..."
        max_attempts=30
        attempt=0
        healthy=false
        
        while [ $attempt -lt $max_attempts ] && [ "$healthy" = "false" ]; do
            attempt=$((attempt + 1))
            sleep 2
            
            health_status=$(docker inspect --format='{{.State.Health.Status}}' eyetui-backend 2>/dev/null || echo "unknown")
            if [ "$health_status" = "healthy" ]; then
                healthy=true
                echo "[READY] Backend is healthy!"
            else
                echo "  Attempt $attempt/$max_attempts - Backend status: $health_status"
            fi
        done
        
        if [ "$healthy" = "false" ]; then
            echo ""
            echo "[WARN] Backend health check timed out. Check logs with: docker-compose logs backend"
        fi
        ;;
    *)
        if [ "$MODE" = "build" ]; then
            echo ""
            echo "[START] Building and starting containers..."
            docker-compose $COMPOSE_FILES up -d --build
        else
            echo ""
            echo "[START] Starting containers (mode: $MODE)..."
            docker-compose $COMPOSE_FILES up -d
        fi
        
        echo ""
        echo "[WAIT] Waiting for backend to be healthy..."
        max_attempts=30
        attempt=0
        healthy=false
        
        while [ $attempt -lt $max_attempts ] && [ "$healthy" = "false" ]; do
            attempt=$((attempt + 1))
            sleep 2
            
            health_status=$(docker inspect --format='{{.State.Health.Status}}' eyetui-backend 2>/dev/null || echo "unknown")
            if [ "$health_status" = "healthy" ]; then
                healthy=true
                echo "[READY] Backend is healthy!"
            else
                echo "  Attempt $attempt/$max_attempts - Backend status: $health_status"
            fi
        done
        
        if [ "$healthy" = "false" ]; then
            echo ""
            echo "[WARN] Backend health check timed out. Check logs with: docker-compose logs backend"
        fi
        ;;
esac

echo ""
echo "[STATUS] Container status:"
docker ps --filter "name=eyetui" --format "table {{.Names}}\t{{.Status}}"

echo ""
echo "[INFO] Application ready at:"
echo "  Frontend: http://localhost or http://127.0.0.1"
echo "  API Docs: http://localhost:8001/docs"
