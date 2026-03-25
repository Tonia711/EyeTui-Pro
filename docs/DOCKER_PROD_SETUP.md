# Production (Docker + Tailscale HTTPS) Setup Guide

> Complete setup for running EyeTui in production with Docker, Tailscale sidecar, and HTTPS

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Step 1: Tailscale Admin Console](#step-1-tailscale-admin-console)
3. [Step 2: Set TS_AUTHKEY](#step-2-set-ts_authkey)
4. [Step 3: Pull and Start Containers](#step-3-pull-and-start-containers)
5. [Step 4: Confirm Tailscale Login](#step-4-confirm-tailscale-login)
6. [Step 5: Generate HTTPS Certificates](#step-5-generate-https-certificates)
7. [Step 6: Restart Frontend](#step-6-restart-frontend)
8. [Step 7: Verify Status](#step-7-verify-status)
9. [Access the Application](#access-the-application)
10. [Stopping and Restarting](#stopping-and-restarting)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Docker and Docker Compose installed
- Tailscale account with access to [admin console](https://login.tailscale.com/admin)
- Project root directory: `EyeTui/`

---

## Step 1: Tailscale Admin Console

1. Open [Tailscale Admin Console](https://login.tailscale.com/admin/dns)
2. Go to **DNS** → **HTTPS Certificates**
3. Enable HTTPS certificates (if not already enabled)
4. Create an auth key for the Docker container:
   - Go to **Settings** → **Auth Keys**
   - Click **Generate auth key**
   - **Recommended settings:**
     - ✓ Ephemeral (auto-removes when offline for 1 hour)
     - ✓ Pre-authorized (no manual approval needed)
   - Copy the auth key (format: `tskey-xxxxxxxxxxxxxxxx`)

---

## Step 2: Set TS_AUTHKEY

In your project root, create or edit `.env`:

```bash
# .env (in repository root)
TS_AUTHKEY=tskey-xxxxxxxxxxxxxxxx
```

Replace `tskey-xxxxxxxxxxxxxxxx` with your actual auth key from Step 1.

---

## Step 3: Pull and Start Containers

From the project root:

```powershell
# Ensure cert directory exists
New-Item -ItemType Directory -Path "certs\prod" -Force

# Pull latest prod images from GitHub Container Registry
docker-compose -f docker-compose.prod.yml pull

# Start all services in background
docker-compose -f docker-compose.prod.yml up -d
```

Services that will start:
- `db` - PostgreSQL database
- `db-backup` - Automated backup service
- `ts-sidecar` - Tailscale sidecar (handles networking & HTTPS)
- `backend` - FastAPI backend (runs on localhost:8000 inside sidecar)
- `frontend` - React + Nginx frontend (runs on localhost:80 inside sidecar)

---

## Step 4: Confirm Tailscale Login

```powershell
docker exec eyetui-tailscale tailscale --socket "/tmp/tailscaled.sock" status
```

Expected output (your machine should appear):
```
<TAILSCALE_IP>  eyetui-docker         eyetui@...  linux  -
<OTHER_DEVICE_IP>  other-machine       eyetui@...  windows -
...
```

Note the IP address and hostname (e.g., `eyetui-docker`) - you'll need the full hostname in Step 5.

**If you see "Logged out"**: The auth key is missing or invalid. Check your `.env` file and restart:
```powershell
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d
```

---

## Step 5: Generate HTTPS Certificates

Find your Tailscale hostname from Step 4 output. It follows the pattern: `<machine-name>.<tailnet-suffix>.ts.net`

Example: If Step 4 shows `eyetui-docker`, your hostname is `eyetui-docker.tail<XXXXX>.ts.net`

```powershell
# Replace with your actual tailnet hostname
$HOSTNAME = "eyetui-docker.tail<XXXXX>.ts.net"

docker exec eyetui-tailscale tailscale --socket "/tmp/tailscaled.sock" cert `
  --cert-file /tmp/certs/server.crt `
  --key-file /tmp/certs/server.key `
  $HOSTNAME
```

Expected output:
```
Wrote public cert to /tmp/certs/server.crt
Wrote private key to /tmp/certs/server.key
```

**Note:** Certificates are mounted from `certs/prod/` on host → `/tmp/certs/` in container.

---

## Step 6: Restart Frontend

```powershell
docker-compose -f docker-compose.prod.yml restart frontend
```

This reloads Nginx with the new certificates.

---

## Step 7: Verify Status

```powershell
docker-compose -f docker-compose.prod.yml ps
```

All services should show `Up`:
```
NAME               STATUS
eyetui-db         Up (healthy)
eyetui-db-backup  Up (health: starting)
eyetui-backend    Up
eyetui-frontend   Up
eyetui-tailscale  Up
```

Check frontend logs if needed:
```powershell
docker logs eyetui-frontend --tail=20
```

---

## Access the Application

### Option A: Via Tailscale (Recommended)

Use your Tailscale hostname (from Step 5):

```
https://eyetui-docker.tail<XXXXX>.ts.net
```

This works from any device on your Tailscale network with HTTPS support.

### Option B: Local (Host Machine)

```
https://localhost
```

Note: Browser may warn about self-signed cert, but if you generated via Tailscale in Step 5, it's a valid Let's Encrypt cert.

---

## Stopping and Restarting

### Quick Stop (Preserve Everything)

```powershell
docker-compose -f docker-compose.prod.yml down
```

This stops and removes containers but preserves:
- Database data (`postgres_data/`)
- Backups (`backups/`)
- Certificates (`certs/prod/`) ← **No need to regenerate!**
- Learned rules (`backend/learned_rules.json`)

### Quick Restart (Without Regenerating Certificates)

After stopping, restart with:

```powershell
# Pull latest images (optional)
docker-compose -f docker-compose.prod.yml pull

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Verify
docker-compose -f docker-compose.prod.yml ps
```

**No certificate regeneration needed** — your saved certs in `certs/prod/` will be reused automatically.

### Full Reset (Delete Database Only)

If you need to reset the database and start fresh:

```powershell
# Stop and remove containers + volumes
docker-compose -f docker-compose.prod.yml down -v

# This deletes:
# - All containers
# - Database data (postgres_data/)
# - Backups (if stored in volumes)
# - Learned rules JSON
#
# This PRESERVES:
# - Certificates (certs/prod/)
# - .env configuration

# To restart: follow "Quick Restart" above
```

### Complete Cleanup (Delete Certificates Too)

To stop and clean up completely including certificates:

```powershell
# Remove containers and volumes
docker-compose -f docker-compose.prod.yml down -v

# Delete saved certificates (you'll need to regenerate next time)
rm certs\prod\server.crt, certs\prod\server.key
```

---

## Stop Production Stack

To do a full cleanup with everything deleted:

```powershell
# Remove containers and volumes
docker-compose -f docker-compose.prod.yml down -v
```

See [Stopping and Restarting](#stopping-and-restarting) section above for other stop/restart options without certificate regeneration.

---

## Troubleshooting

### Frontend restarts repeatedly

**Symptom:** `docker-compose ps` shows `frontend` in `Restarting` status

**Cause:** Missing SSL certificates or invalid paths

**Fix:**
```powershell
# Check frontend logs
docker logs eyetui-frontend --tail=50

# Verify certs exist
ls certs\prod\
# Should show: server.crt, server.key

# If missing, re-run Step 5
```

### Can't get Tailscale certificate

**Error:** "your Tailscale account does not support getting TLS certs"

**Possible causes:**
1. HTTPS certificates not enabled in admin console
2. Wrong hostname or auth key
3. Machine not fully authenticated

**Fix:**
```powershell
# 1. Check admin console: https://login.tailscale.com/admin/dns
#    Ensure "HTTPS Certificates" is enabled

# 2. Verify machine status
docker exec eyetui-tailscale tailscale --socket "/tmp/tailscaled.sock" status

# 3. Try cert generation again
# (may take a few seconds after machine appears)
```

### Tailscale not logged in

**Symptom:** Step 4 shows "Logged out"

**Fix:**
1. Check `.env` has `TS_AUTHKEY=tskey-...`
2. Restart containers:
   ```powershell
   docker-compose -f docker-compose.prod.yml down
   docker-compose -f docker-compose.prod.yml up -d
   ```
3. Wait 10 seconds and check login status again

### Backend API not responding

**Symptom:** Frontend loads but API calls fail

**Fix:**
1. Check backend logs:
   ```powershell
   docker logs eyetui-backend --tail=20
   ```

2. Verify database is healthy:
   ```powershell
   docker logs eyetui-db --tail=10
   ```

3. Check database connection in backend logs for `DATABASE_URL` errors

### Need to regenerate certificates

```powershell
# Remove old certs
rm certs\prod\server.crt, certs\prod\server.key

# Re-run Step 5 with your hostname
$HOSTNAME = "eyetui-docker.tail<XXXXX>.ts.net"
docker exec eyetui-tailscale tailscale --socket "/tmp/tailscaled.sock" cert `
  --cert-file /tmp/certs/server.crt `
  --key-file /tmp/certs/server.key `
  $HOSTNAME

# Restart frontend
docker-compose -f docker-compose.prod.yml restart frontend
```

---

## Architecture Summary

```
┌─────────────────────────────────────────────────┐
│ Host Machine (e.g., Windows)                    │
│                                                 │
│  Port 80 (HTTP) ──┐                             │
│  Port 443 (HTTPS)─┤                             │
│  Port 5433 (DB)  ─┼─────> Docker Container     │
│                  │                              │
│  .env           ─┼─> Env variables             │
│  certs/prod/    ─┘─> Mount /tmp/certs (read)  │
│      ├─ server.crt                              │
│      └─ server.key                              │
└─────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────┐
│ Docker Network (docker-compose.prod.yml)        │
│                                                 │
│  ┌─────────────────────────────────────────┐  │
│  │ Tailscale Sidecar (ts-sidecar)          │  │
│  │ - Handles WireGuard networking          │  │
│  │ - Exposes ports 80, 443                 │  │
│  │ - Mounts /tmp/certs (write from gen)   │  │
│  │ - network_mode: bridge (default)        │  │
│  └─────────────────────────────────────────┘  │
│                                                 │
│  ┌─────────────────┐  ┌─────────────────────┐ │
│  │ Frontend        │  │ Backend             │ │
│  │ (React + Nginx) │  │ (FastAPI)           │ │
│  │ localhost:80    │  │ localhost:8000      │ │
│  │ localhost:443   │  │                     │ │
│  │ network_mode:   │  │ network_mode:       │ │
│  │ service:ts-    │  │ service:ts-sidecar  │ │
│  │ sidecar         │  │ DATABASE_URL: db:   │ │
│  │ (shared network)│  │ 5432 (internal)    │ │
│  └─────────────────┘  └─────────────────────┘ │
│                                                 │
│  ┌─────────────────┐  ┌─────────────────────┐ │
│  │ PostgreSQL (db) │  │ Backup Service      │ │
│  │ 5432 (internal) │  │ (daily schedule)    │ │
│  │ Port 5433 (ext) │  │                     │ │
│  └─────────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────┐
│ Tailscale Network                               │
│ - Encrypted VPN tunnel                          │
│ - Accessible from other Tailscale devices      │
│ - Hostname: eyetui-docker.tailXXXXX.ts.net    │
└─────────────────────────────────────────────────┘
```
