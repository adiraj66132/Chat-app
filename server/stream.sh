#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLIENT="$ROOT/client"
SERVER="$ROOT/server"

# 1. Pick the first non-loopback IPv4 address (prefer 192.168.* and 10.*)
IP=$(ip -4 -o addr show | awk '!/ lo /{print $4}' | cut -d/ -f1 | head -1)
if [ -z "$IP" ]; then
  echo "Could not detect local IP address."
  exit 1
fi

echo "── Local IP: $IP ──"

# 2. Build the client if dist/ is missing
if [ ! -d "$CLIENT/dist" ]; then
  echo "Building client …"
  (cd "$CLIENT" && npm run build)
  echo ""
fi

# 3. Start PostgreSQL if not running
if ! pg_isready -q -h localhost -p 5432 2>/dev/null; then
  echo "Starting PostgreSQL …"
  eval "$(npm prefix -s 2>/dev/null || echo "$SERVER")" && npm run db:start 2>/dev/null || \
  pg_ctl -D ~/pgdata -o "-p 5432 -k /tmp" -l ~/pg.log start
  sleep 1
fi

# 4. Start the server
echo ""
echo "Your family can now open http://$IP:3001 in their browser"
echo "Press Ctrl+C to stop"
echo ""
(cd "$SERVER" && npm run dev)
