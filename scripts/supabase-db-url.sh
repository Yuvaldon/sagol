#!/usr/bin/env bash
# Prints the connection string `supabase db push --db-url` uses in the Staging and Production workflows (D-289):
# the primary database through the pooler in session mode (port 5432), which runners reach over IPv4, unlike the
# direct db.<ref> host. The host, user and database come from GET /v1/projects/{ref}/config/database/pooler; the
# password is SUPABASE_DB_PASSWORD, percent-encoded. The caller masks the printed URL before using it.
set -euo pipefail

test -n "${PROJECT_REF:-}" || { echo "::error::the project ref is not set" >&2; exit 1; }
test -n "${SUPABASE_ACCESS_TOKEN:-}" || { echo "::error::SUPABASE_ACCESS_TOKEN is not set" >&2; exit 1; }
test -n "${SUPABASE_DB_PASSWORD:-}" || { echo "::error::SUPABASE_DB_PASSWORD is not set" >&2; exit 1; }

config=$(curl -sS --fail-with-body -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  "https://api.supabase.com/v1/projects/$PROJECT_REF/config/database/pooler") ||
  { echo "::error::GET /v1/projects/{ref}/config/database/pooler failed" >&2; exit 1; }

jq -er --arg password "$SUPABASE_DB_PASSWORD" '
  [.[] | select(.database_type == "PRIMARY")] | first
  | select(.db_host != null and .db_user != null and .db_name != null)
  | "postgresql://\(.db_user | @uri):\($password | @uri)@\(.db_host):5432/\(.db_name | @uri)"' <<<"$config" ||
  { echo "::error::the pooler config has no primary database" >&2; exit 1; }
