#!/usr/bin/env bash
# Runs docs/office-app/sql/001_init.sql twice (must be re-runnable) on a throw-away local Postgres with Supabase-like
# stubs, then the RLS scenario test. Usage: bash scripts/office/test_sql.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BIN="$(ls -d /usr/lib/postgresql/*/bin | tail -1)"
TMP="$(mktemp -d)"
trap '"$BIN/pg_ctl" -D "$TMP/data" stop -m immediate >/dev/null 2>&1 || true; rm -r "$TMP"' EXIT
if [ "$(id -u)" = "0" ]; then RUN=(runuser -u postgres --); chown postgres "$TMP"; else RUN=(); fi
"${RUN[@]}" "$BIN/initdb" -D "$TMP/data" -U postgres >/dev/null
"${RUN[@]}" "$BIN/pg_ctl" -D "$TMP/data" -o "-k $TMP -p 55432 -c listen_addresses=''" -l "$TMP/log" start >/dev/null
PSQL=("${RUN[@]}" psql -h "$TMP" -p 55432 -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f "$ROOT/scripts/office/supabase_stub.sql"
"${PSQL[@]}" -f "$ROOT/docs/office-app/sql/001_init.sql"
"${PSQL[@]}" -f "$ROOT/docs/office-app/sql/001_init.sql"
echo "001_init.sql ran twice without errors"
for n in 1 2 3 4; do "${PSQL[@]}" -f "$ROOT/docs/office-app/sql/001_part$n.sql"; done
echo "the 4 parts ran again without errors"
"${PSQL[@]}" -f "$ROOT/docs/office-app/sql/002_check.sql"
"${PSQL[@]}" -f "$ROOT/scripts/office/test_rls.sql" 2>&1 | grep -E "ok:|FAILED|PASSED|ERROR" || true
