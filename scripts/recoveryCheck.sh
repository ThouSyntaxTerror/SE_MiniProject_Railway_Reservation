#!/usr/bin/env bash
# NFR-04 evidence helper: prove that a committed booking survives an application restart and
# that the service answers /health within 60 seconds.
#
# Usage (from repo root):
#   ./scripts/recoveryCheck.sh http://localhost:3000
#
# Requires: curl, python3, and a running API with the seeded passenger account.
set -euo pipefail

BASE="${1:-http://localhost:3000}"
EMAIL="${RECOVERY_EMAIL:-passenger@rrs.test}"
PASSWORD="${RECOVERY_PASSWORD:-PassengerPass123}"

login() {
  curl -sf -X POST "$BASE/api/sessions" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" |
    python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])'
}

TOKEN="$(login)"
TRIPS="$(curl -sf "$BASE/api/trips?origin=Bengaluru&destination=Chennai&date=$(date -u -d '+1 day' +%F)")"
TRIP_ID="$(echo "$TRIPS" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d[0]["id"])')"

PNR="$(curl -sf -X POST "$BASE/api/bookings" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -H "Idempotency-Key: recovery-$(date +%s)" \
  -d "{\"tripId\": $TRIP_ID}" | python3 -c 'import json,sys; print(json.load(sys.stdin)["pnr"])')"
echo "Created booking PNR=$PNR"

echo "Restart the API now, then press Enter."
read -r

START=$(date +%s%3N)
until curl -sf "$BASE/health" >/dev/null; do sleep 0.2; done
END=$(date +%s%3N)
echo "Health responded in $((END - START)) ms (target < 60000 ms)"

TOKEN="$(login)"
FOUND="$(curl -sf "$BASE/api/bookings" -H "Authorization: Bearer $TOKEN" |
  python3 -c "import json,sys; print(any(b['pnr']=='$PNR' for b in json.load(sys.stdin)))")"
echo "Booking $PNR still present after restart: $FOUND"
[ "$FOUND" = "True" ]
