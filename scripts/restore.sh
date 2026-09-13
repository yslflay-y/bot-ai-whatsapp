#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Restore Script for WhatsApp AI Assistant
# Restores PostgreSQL database dump and WhatsApp session credentials
# Usage: ./scripts/restore.sh path/to/backup.tar.gz
# ==============================================================================

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <path_to_backup.tar.gz>"
  exit 1
fi

ARCHIVE_PATH="$1"
TEMP_RESTORE_DIR=$(mktemp -d)

trap 'rm -rf "${TEMP_RESTORE_DIR}"' EXIT

echo "[+] Extracting backup archive: ${ARCHIVE_PATH}..."
tar -xzf "${ARCHIVE_PATH}" -C "${TEMP_RESTORE_DIR}"

EXTRACTED_DIR=$(find "${TEMP_RESTORE_DIR}" -mindepth 1 -maxdepth 1 -type d | head -n 1)

# 1. Restore WhatsApp session keys
if [ -d "${EXTRACTED_DIR}/auth_backup" ]; then
  echo "[+] Restoring WhatsApp session data..."
  docker compose cp "${EXTRACTED_DIR}/auth_backup/." app:/app/data/auth/
fi

# 2. Restore PostgreSQL database
if [ -f "${EXTRACTED_DIR}/db_backup.dump" ]; then
  echo "[+] Restoring PostgreSQL database..."
  docker compose cp "${EXTRACTED_DIR}/db_backup.dump" postgres:/tmp/db_restore.dump
  docker compose exec -T postgres pg_restore -U assistant -d whatsapp_assistant --clean --if-exists /tmp/db_restore.dump || true
  docker compose exec -T postgres rm /tmp/db_restore.dump
fi

echo "[✔] Restore finished. Restarting app container..."
docker compose restart app
echo "[✔] App restarted."
