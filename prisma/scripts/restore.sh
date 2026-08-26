#!/usr/bin/env bash
# Restore Supabase Postgres DB from a pg_dump custom-format backup.
# WARNING: this can overwrite existing data. Double-check DIRECT_URL points
# to the intended database (staging, not production, unless intentional).
# Usage: ./prisma/scripts/restore.sh path/to/backup.dump

set -euo pipefail

if [ -z "${DIRECT_URL:-}" ]; then
  echo "ERROR: DIRECT_URL env var is not set."
  exit 1
fi

BACKUP_FILE="${1:-}"
if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "Usage: $0 path/to/backup.dump"
  exit 1
fi

read -p "This will restore into the database at DIRECT_URL. Continue? (yes/no) " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

echo "Restoring from $BACKUP_FILE ..."
pg_restore --clean --if-exists --no-owner --dbname="$DIRECT_URL" "$BACKUP_FILE"
echo "Restore complete."
