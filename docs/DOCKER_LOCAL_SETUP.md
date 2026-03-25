# EyeTui Local Docker Deployment

Easy local deployment using Docker. No need to install PostgreSQL, Python, or Node.js manually.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- Git installed

## Quick Start

```bash
# Clone repository
git clone <repository-url>
cd EyeTui

# Verify Docker is running
docker --version
docker-compose --version
docker ps
```

---

## Option A: Pull Pre-built Images (~1-2 minutes, Recommended)

We use GitHub CI/CD workflow to automatically build Docker images whenever code is pushed to the `deploy-release` branch. Team members with repository access can simply pull these pre-built images instead of building locally.

### Why GHCR (GitHub Container Registry)?

For private repositories, we configure Docker images to be accessible only to repository members. This follows GHCR's security model, ensuring that:
- Only authenticated team members can pull images
- No need to expose images publicly
- Leverages existing GitHub repository permissions

### First-Time Setup: Authenticate with GHCR

```bash
docker login ghcr.io
```

When prompted:
- **Username:** Your GitHub username
- **Password:** A Personal Access Token (not your GitHub password)

To generate a token:
1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Check the `read:packages` scope
4. Copy the generated token and use it as your password

### Start the Application

```powershell
# Windows
.\start.ps1 -Pull
```

```bash
# Linux/Mac
./start.sh local pull
```

---

## Option B: Build Images Locally (~5-15 minutes on first run)

If you need to build from source:

```powershell
# Windows
.\start.ps1 -Mode build
```

```bash
# Linux/Mac
./start.sh build
```

Or manually:
```bash
docker-compose up --build -d
```

---

## Access the Application

Once containers are running:

| Service | URL |
|---------|-----|
| **Frontend** | http://localhost or http://127.0.0.1 |
| **Backend API Docs** | http://localhost:8001/docs |

---

## Common Commands

```powershell
# Check container status
docker ps --filter "name=eyetui"

# View logs
docker-compose logs -f

# Stop all containers
.\start.ps1 -Down              # Windows
./start.sh local down          # Linux/Mac

# Pull latest images and restart
.\start.ps1 -Pull              # Windows
./start.sh local pull          # Linux/Mac
```

---

## Architecture Summary

```
┌──────────────────────────────────────────────┐
│ Host Machine (Your Computer)                 │
│                                              │
│  Port 80 (Frontend) ──┐                      │
│  Port 8001 (API)  ────┼──> Docker Containers│
│  Port 5433 (DB)   ────┘                      │
└──────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────┐
│ Docker Network (docker-compose.yml)          │
│                                              │
│  ┌──────────────────┐  ┌──────────────────┐ │
│  │ Frontend         │  │ Backend          │ │
│  │ (React + Nginx)  │  │ (FastAPI)        │ │
│  │ :80, :443        │  │ :8000            │ │
│  │                  │  │ DATABASE_URL: db │ │
│  └──────────────────┘  └──────────────────┘ │
│                                              │
│  ┌──────────────────┐                        │
│  │ PostgreSQL (db)  │                        │
│  │ :5432 (internal) │                        │
│  │ 5433 (exposed)   │                        │
│  └──────────────────┘                        │
└──────────────────────────────────────────────┘
```

---

## Startup Script Modes

| Mode | Command | Description |
|------|---------|-------------|
| `local` (default) | `.\start.ps1` | HTTP mode, pulls from GHCR |
| `build` | `.\start.ps1 -Mode build` | Build images locally |
