# EyeTui Docker Startup Script (PowerShell)
# Ensures required files exist before starting containers

param(
    [string]$Mode = "local",  # Options: local (HTTP), ghcr (HTTPS), build, prod
    [switch]$Pull,            # Pull latest images before starting
    [switch]$Down             # Stop containers instead of starting
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

# Ensure required files exist (prevents Docker from creating directories)
$RequiredFiles = @(
    @{ Path = "backend/learned_rules.json"; Content = "{}" }
)

foreach ($file in $RequiredFiles) {
    $fullPath = Join-Path $ProjectRoot $file.Path
    
    # Check if it's a directory (Docker error) and remove it
    if (Test-Path $fullPath -PathType Container) {
        Write-Host "[FIX] Removing directory that should be a file: $($file.Path)" -ForegroundColor Yellow
        Remove-Item $fullPath -Recurse -Force
    }
    
    # Create file if it doesn't exist
    if (-not (Test-Path $fullPath -PathType Leaf)) {
        Write-Host "[CREATE] Creating missing file: $($file.Path)" -ForegroundColor Cyan
        $dir = Split-Path $fullPath -Parent
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }
        Set-Content -Path $fullPath -Value $file.Content -NoNewline
    }
}

# Build docker-compose command
$composeFiles = switch ($Mode) {
    "local" { @("-f", "docker-compose.yml", "-f", "docker-compose.local.yml") }
    "ghcr"  { @("-f", "docker-compose.yml", "-f", "docker-compose.ghcr.yml") }
    "build" { @("-f", "docker-compose.yml") }
    "prod"  { @("-f", "docker-compose.prod.yml") }
    default { @("-f", "docker-compose.yml", "-f", "docker-compose.local.yml") }
}

Push-Location $ProjectRoot
try {
    if ($Down) {
        Write-Host "`n[STOP] Stopping containers..." -ForegroundColor Magenta
        & docker-compose @composeFiles down
    } else {
        if ($Pull) {
            Write-Host "`n[PULL] Pulling latest images..." -ForegroundColor Cyan
            & docker-compose @composeFiles pull
        }
        
        $buildArg = if ($Mode -eq "build") { "--build" } else { $null }
        
        Write-Host "`n[START] Starting containers (mode: $Mode)..." -ForegroundColor Green
        if ($buildArg) {
            & docker-compose @composeFiles up -d $buildArg
        } else {
            & docker-compose @composeFiles up -d
        }
        
        Write-Host "`n[WAIT] Waiting for backend to be healthy..." -ForegroundColor Yellow
        $maxAttempts = 30
        $attempt = 0
        $healthy = $false
        
        while ($attempt -lt $maxAttempts -and -not $healthy) {
            $attempt++
            Start-Sleep -Seconds 2
            
            $healthStatus = docker inspect --format='{{.State.Health.Status}}' eyetui-backend 2>$null
            if ($healthStatus -eq "healthy") {
                $healthy = $true
                Write-Host "[READY] Backend is healthy!" -ForegroundColor Green
            } else {
                Write-Host "  Attempt $attempt/$maxAttempts - Backend status: $healthStatus" -ForegroundColor Gray
            }
        }
        
        if (-not $healthy) {
            Write-Host "`n[WARN] Backend health check timed out. Check logs with: docker-compose logs backend" -ForegroundColor Yellow
        }
        
        Write-Host "`n[STATUS] Container status:" -ForegroundColor Cyan
        & docker ps --filter "name=eyetui" --format "table {{.Names}}`t{{.Status}}"
        
        Write-Host "`n[INFO] Application ready at:" -ForegroundColor Cyan
        Write-Host "  Frontend: http://localhost or http://127.0.0.1" -ForegroundColor White
        Write-Host "  API Docs: http://localhost:8001/docs" -ForegroundColor White
    }
} finally {
    Pop-Location
}
