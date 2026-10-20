#!/usr/bin/env bash
# rotate-logs.sh — hapus error_log + log_kasir >30 hari.
# Jalankan via cron bulanan di server.
#
# Usage:
#   ./scripts/rotate-logs.sh                 # delete >30 hari
#   ./scripts/rotate-logs.sh --dry-run 60    # preview, threshold 60 hari
#
# Cron (server, /etc/cron.d/zpos-rotate):
#   0 3 1 * * djvpri /home/djvpri/zpos/scripts/rotate-logs.sh >> /var/log/zpos-rotate.log 2>&1
set -euo pipefail

DAYS=30
DRY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY=1; shift ;;
    [0-9]*) DAYS="$1"; shift ;;
    *) echo "Unknown: $1" >&2; exit 2 ;;
  esac
done

SSH_TARGET="djvpri@103.93.129.94"
DB_CONTAINER="1fhosrzrapewqtv4wkqiw1rs"

echo "Rotate log z1pos — threshold: ${DAYS} hari, dry-run: ${DRY}"

# Build SQL — dry-run pakai SELECT count, real pakai DELETE
if [[ "$DRY" -eq 1 ]]; then
  SQL="SELECT 'error_log' AS tbl, count(*) AS would_delete FROM error_log WHERE ts < now() - interval '${DAYS} days'
       UNION ALL
       SELECT 'log_kasir', count(*) FROM log_kasir WHERE created_at < now() - interval '${DAYS} days';"
else
  SQL="DELETE FROM error_log WHERE ts < now() - interval '${DAYS} days';
       DELETE FROM log_kasir WHERE created_at < now() - interval '${DAYS} days';"
fi

ssh -o ConnectTimeout=10 "$SSH_TARGET" "sudo docker exec $DB_CONTAINER psql -U postgres -d postgres -c \"$SQL\"" 2>&1

if [[ "$DRY" -eq 0 ]]; then
  echo ""
  echo "Done. VACUUM ANALYZE utk reclaim space:"
  echo "  ssh $SSH_TARGET \"sudo docker exec $DB_CONTAINER psql -U postgres -d postgres -c 'VACUUM ANALYZE error_log; VACUUM ANALYZE log_kasir;'\""
fi