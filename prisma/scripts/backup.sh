#!/usr/bin/env bash
# Backup Supabase Postgres DB via pg_dump.
# Requires: DIRECT_URL set in environment (direct connection, not pgbouncer).
# Usage: ./prisma/scripts/backup.sh [output-dir]

set -euo pipefail

if [ -z "${DIRECT_URL:-}" ]; then
  echo "ERROR: DIRECT_URL env var is not set. Load your .env first (e.g. 'export \$(grep -v '^#' .env | xargs)')."
  exit 1
fi

OUT_DIR="${1:-./backups}"
mkdir -p "$OUT_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUT_FILE="$OUT_DIR/backup_${TIMESTAMP}.dump"

echo "Backing up database to $OUT_FILE ..."
pg_dump "$DIRECT_URL" -F c -f "$OUT_FILE"
echo "Done: $OUT_FILE"
