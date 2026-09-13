#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Automated Backup Script for WhatsApp AI Assistant
# Backs up PostgreSQL database dump and WhatsApp session credentials
# ==============================================================================

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
TARGET_DIR="${BACKUP_DIR}/${TIMESTAMP}"

mkdir -p "${TARGET_DIR}"

echo "[+] Starting backup at ${TIMESTAMP}..."

# 1. Backup PostgreSQL database via docker exec
echo "[+] Dumping PostgreSQL database..."
docker compose exec -T postgres pg_dump -U assistant -d whatsapp_assistant -F c -b -v -f /tmp/db_backup.dump
docker compose cp postgres:/tmp/db_backup.dump "${TARGET_DIR}/db_backup.dump"
docker compose exec -T postgres rm /tmp/db_backup.dump

# 2. Backup WhatsApp auth session keys from docker volume
echo "[+] Backing up WhatsApp session data..."
docker compose cp app:/app/data/auth "${TARGET_DIR}/auth_backup"

# 3. Compress backup bundle
echo "[+] Compressing backup archive..."
tar -czf "${TARGET_DIR}.tar.gz" -C "${BACKUP_DIR}" "${TIMESTAMP}"
rm -rf "${TARGET_DIR}"

echo "[✔] Backup completed successfully: ${TARGET_DIR}.tar.gz"
