#!/usr/bin/env pwsh
<#
.SYNOPSIS
    EyeTui Database Restore Script
.DESCRIPTION
    Restores PostgreSQL database from backup files for the EyeTui Docker environment.
.PARAMETER BackupFile
    Optional: Specific backup file path (relative to /backups in container).
    Example: "last/hospital_lens-20260202-000421.sql.gz"
    If not specified, automatically selects the largest (most complete) backup.
.PARAMETER Force
    Skip confirmation prompt
.EXAMPLE
    .\restore_database.ps1
    # Auto-selects best backup and prompts for confirmation
.EXAMPLE
    .\restore_database.ps1 -BackupFile "daily/hospital_lens-20260202.sql.gz"
    # Restore from specific backup
.EXAMPLE
    .\restore_database.ps1 -Force
    # Auto-restore without confirmation
#>

param(
    [Parameter(Mandatory=$false)]
    [string]$BackupFile,
    
    [Parameter(Mandatory=$false)]
    [switch]$Force
)

# Don't stop on stderr output from docker/psql
$ErrorActionPreference = "Continue"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "EyeTui Database Restore Script" -ForegroundColor Cyan  
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
try {
    docker info 2>&1 | Out-Null
} catch {
    Write-Host "ERROR: Docker is not running. Please start Docker first." -ForegroundColor Red
    exit 1
}

# Check if the eyetui-db container is running
$containerRunning = docker ps --filter "name=eyetui-db" --filter "status=running" --format "{{.Names}}"
if (-not $containerRunning) {
    Write-Host "ERROR: eyetui-db container is not running." -ForegroundColor Red
    Write-Host "Please run: docker-compose -f docker-compose.prod.yml up -d" -ForegroundColor Yellow
    exit 1
}
Write-Host "[OK] Docker container eyetui-db is running" -ForegroundColor Green
Write-Host ""

# List available backups
Write-Host "Available backup files:" -ForegroundColor Yellow
Write-Host ""

Write-Host "--- Last backups (most recent) ---" -ForegroundColor Magenta
docker exec eyetui-db sh -c "ls -lhS /backups/last/*.sql.gz 2>/dev/null | grep -v latest || echo 'No backups found'"
Write-Host ""

Write-Host "--- Daily backups ---" -ForegroundColor Magenta
docker exec eyetui-db sh -c "ls -lhS /backups/daily/*.sql.gz 2>/dev/null || echo 'No daily backups found'"
Write-Host ""

Write-Host "--- Weekly backups ---" -ForegroundColor Magenta
docker exec eyetui-db sh -c "ls -lhS /backups/weekly/*.sql.gz 2>/dev/null || echo 'No weekly backups found'"
Write-Host ""

Write-Host "--- Monthly backups ---" -ForegroundColor Magenta
docker exec eyetui-db sh -c "ls -lhS /backups/monthly/*.sql.gz 2>/dev/null || echo 'No monthly backups found'"
Write-Host ""

# Select backup file
if (-not $BackupFile) {
    Write-Host "Finding the best backup to restore (largest file with most data)..." -ForegroundColor Yellow
    
    # Find the largest backup file in /backups/last folder (sorted by size, largest first)
    $BackupFile = docker exec eyetui-db sh -c "ls -S /backups/last/*.sql.gz 2>/dev/null | grep -v latest | head -1"
    
    if (-not $BackupFile) {
        # Try daily backups
        $BackupFile = docker exec eyetui-db sh -c "ls -S /backups/daily/*.sql.gz 2>/dev/null | head -1"
    }
    
    if (-not $BackupFile) {
        Write-Host "ERROR: No backup files found!" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Selected backup: $BackupFile" -ForegroundColor Green
} else {
    $BackupFile = "/backups/$BackupFile"
    Write-Host "Using specified backup: $BackupFile" -ForegroundColor Green
    
    # Verify file exists
    $fileExists = docker exec eyetui-db sh -c "test -f '$BackupFile' && echo 'exists'"
    if ($fileExists -ne "exists") {
        Write-Host "ERROR: Backup file not found: $BackupFile" -ForegroundColor Red
        exit 1
    }
}

# Show backup file info
Write-Host ""
Write-Host "Backup file details:" -ForegroundColor Yellow
docker exec eyetui-db sh -c "ls -lh $BackupFile"
Write-Host ""

# Confirmation
if (-not $Force) {
    $confirm = Read-Host "Do you want to restore from this backup? This will REPLACE all current data. (Y/N)"
    if ($confirm -ne "Y" -and $confirm -ne "y") {
        Write-Host "Restore cancelled." -ForegroundColor Yellow
        exit 0
    }
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Starting database restore..." -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Drop all existing objects in the database
Write-Host "[1/4] Dropping existing database objects..." -ForegroundColor Yellow
$result = docker exec eyetui-db psql -U postgres -d hospital_lens -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;"
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to reset database schema" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Database schema reset" -ForegroundColor Green

# Step 2: Restore from backup
Write-Host "[2/4] Restoring data from backup..." -ForegroundColor Yellow
$restoreOutput = docker exec eyetui-db sh -c "zcat $BackupFile | psql -U postgres -d hospital_lens 2>&1"
$restoreOutput -split "`n" | ForEach-Object {
    if ($_ -match "COPY \d+") {
        Write-Host $_ -ForegroundColor Green
    } elseif ($_ -match "ERROR" -and $_ -notmatch "already exists" -and $_ -notmatch "transaction_timeout") {
        Write-Host $_ -ForegroundColor Red
    }
}
Write-Host "[OK] Backup restore completed" -ForegroundColor Green

# Step 3: Run schema migrations (optional - ensures latest schema)
Write-Host "[3/4] Running schema migrations to ensure up-to-date schema..." -ForegroundColor Yellow
docker exec eyetui-db psql -U postgres -d hospital_lens -f /docker-entrypoint-initdb.d/01-schema.sql 2>&1 | Out-Null
Write-Host "[OK] Schema migrations completed" -ForegroundColor Green

# Step 4: Verify restoration
Write-Host "[4/4] Verifying restored data..." -ForegroundColor Yellow
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Database content summary:" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

docker exec eyetui-db psql -U postgres -d hospital_lens -c "SELECT 'company' as table_name, COUNT(*) as count FROM company UNION ALL SELECT 'supplier', COUNT(*) FROM supplier UNION ALL SELECT 'site', COUNT(*) FROM site UNION ALL SELECT 'lens_type', COUNT(*) FROM lens_type UNION ALL SELECT 'lens', COUNT(*) FROM lens UNION ALL SELECT 'invoice', COUNT(*) FROM invoice ORDER BY table_name;"

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to verify database content" -ForegroundColor Red
    exit 1
}

# Show sample data
Write-Host ""
Write-Host "Sample lens data:" -ForegroundColor Yellow
docker exec eyetui-db psql -U postgres -d hospital_lens -c "SELECT id, serial_number, is_used, power, received_date FROM lens LIMIT 5;"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "Database restore completed successfully!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "You can now access your data through the EyeTui application." -ForegroundColor Cyan
Write-Host ""
