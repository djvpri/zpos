#!/usr/bin/env bash
# log-errors.sh — wrapper satu perintah utk cek error log z1pos.
# Output JSON terstruktur. AI-agent friendly.
#
# Usage:
#   ./scripts/log-errors.sh                    # 24 jam default
#   ./scripts/log-errors.sh --since 6h         # 6 jam terakhir
#   ./scripts/log-errors.sh --pattern UTF8    # filter pattern
#   ./scripts/log-errors.sh --device PC-KASIR-1
#   ./scripts/log-errors.sh --json             # raw JSON (default)
#   ./scripts/log-errors.sh --table            # tabel formatted
#
# Output: array of {fingerprint, code, route, method, status, hits, last_ts, sample_message, sample_param}
# Output di-print ke stdout. Errors ke stderr.
#
# Env:
#   SSH_HOST — default djvpri@103.93.129.94
#   PG_CONTAINER — default 1fhosrzrapewqtv4wkqiw1rs
#   DOCKER_CONTAINER — default (auto-detect)
set -euo pipefail

SINCE="24 hours"
PATTERN=""
DEVICE=""
FORMAT="json"
SSH_HOST="${SSH_HOST:-djvpri@103.93.129.94}"
PG_CONTAINER="${PG_CONTAINER:-1fhosrzrapewqtv4wkqiw1rs}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --since) SINCE="$2"; shift 2 ;;
    --pattern) PATTERN="$2"; shift 2 ;;
    --device) DEVICE="$2"; shift 2 ;;
    --json) FORMAT="json"; shift ;;
    --table) FORMAT="table"; shift ;;
    -h|--help)
      sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "Unknown: $1" >&2; exit 2 ;;
  esac
done

# Build WHERE clause
WHERE="ts > now() - interval '$SINCE'"
[[ -n "$PATTERN" ]] && WHERE="$WHERE AND message ILIKE '%$PATTERN%'"
[[ -n "$DEVICE" ]] && WHERE="$WHERE AND device_id = '$DEVICE'"

QUERY="SELECT json_agg(r) FROM (
  SELECT fingerprint, code, route, method, status,
         count(*)::int AS hits,
         to_char(max(ts), 'YYYY-MM-DD\"T\"HH24:MI:SSOF') AS last_ts,
         min(message) AS sample_message,
         min(param) AS sample_param
  FROM error_log
  WHERE $WHERE
    AND (device_id IS NULL OR device_id = '')
  GROUP BY fingerprint, code, route, method, status
  ORDER BY hits DESC
  LIMIT 20
) r"

if [[ "$FORMAT" == "table" ]]; then
  QUERY="SELECT fingerprint, code, route, method, status, count(*)::int AS hits, max(ts) AS last_ts, min(message) AS sample FROM error_log WHERE $WHERE GROUP BY fingerprint, code, route, method, status ORDER BY hits DESC LIMIT 20"
fi

# SSH execute psql
PSQL_CMD="psql -U postgres -d postgres -t -A -c \"$QUERY\""
echo "Executing: ssh $SSH_HOST \"docker exec $PG_CONTAINER $PSQL_CMD\"" >&2

RESULT=$(ssh -o ConnectTimeout=8 "$SSH_HOST" "sudo docker exec $PG_CONTAINER $PSQL_CMD" 2>&1) || {
  echo "FAIL: $RESULT" >&2
  exit 1
}

if [[ "$FORMAT" == "json" ]]; then
  # Null = empty result
  [[ -z "$RESULT" || "$RESULT" == "null" ]] && echo "[]" && exit 0
  echo "$RESULT"
else
  echo "$RESULT"
fi