#!/usr/bin/env bash
# Ensure the local Postgres is running and the schema is migrated before the
# server boots. Wired via npm's predev/prestart hooks so a single
# `npm run dev` / `npm start` is enough — no separate DB command needed.
set -euo pipefail

PGDATA="${PGDATA:-$HOME/pgdata}"
PGPORT="${PGPORT:-5432}"

if pg_isready -h localhost -p "$PGPORT" >/dev/null 2>&1; then
  echo "[db] Postgres already running on :$PGPORT"
else
  echo "[db] Starting Postgres (data dir: $PGDATA)…"
  pg_ctl -D "$PGDATA" -o "-p $PGPORT -k /tmp" -l "$HOME/pg.log" start
  # Wait until it actually accepts connections.
  for _ in $(seq 1 30); do
    pg_isready -h localhost -p "$PGPORT" >/dev/null 2>&1 && break
    sleep 0.3
  done
  pg_isready -h localhost -p "$PGPORT" >/dev/null 2>&1 \
    || { echo "[db] Postgres failed to start — see $HOME/pg.log"; exit 1; }
  echo "[db] Postgres is up"
fi

echo "[db] Applying migrations…"
npx prisma migrate deploy
