#!/usr/bin/env bash
# The guard of the Staging and Production workflows (D-276, D-280). It reads the one project PROJECT_REF names
# through the Management API, which a project-scoped token may do, and stops unless the name fits the run:
# `staging` needs a name ending in -staging, `production` refuses one. Before that it tries, read-only, the calls the
# later steps make, so one run names every permission the token lacks: those of the steps themselves stop the run,
# those `supabase link` only warns about are listed as warnings.
# Usage: supabase-project-guard.sh <staging|production> [required path]... [-- optional path...]
set -euo pipefail

kind=$1
shift
test -n "${PROJECT_REF:-}" || { echo "::error::the project ref is not set"; exit 1; }
test -n "${SUPABASE_ACCESS_TOKEN:-}" || { echo "::error::SUPABASE_ACCESS_TOKEN is not set"; exit 1; }

api="https://api.supabase.com/v1/projects/$PROJECT_REF"
body=$(mktemp)
required=()
optional=()

# Sets `found` to the permissions a 403 names; stops the run on any other error.
probe() {
  local path=$1 status
  found=()
  status=$(curl -sS -o "$body" -w '%{http_code}' -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" "$api$path")
  case "$status" in
    2??) ;;
    403) mapfile -t found < <(jq -r '.error.missing_permissions[]? // empty' "$body" | sed "s|\$| (GET /v1/projects/{ref}$path)|")
      test "${#found[@]}" -gt 0 || found=("access to GET /v1/projects/{ref}$path: $(jq -r '.message // empty' "$body")") ;;
    *) echo "::error::GET /v1/projects/{ref}$path answered $status"; exit 1 ;;
  esac
}

probe ""
name=$(jq -r '.name // empty' "$body")
required+=("${found[@]}")
target=required
for path in "$@"; do
  if [ "$path" = -- ]; then target=optional; continue; fi
  probe "$path"
  if [ "$target" = required ]; then required+=("${found[@]}"); else optional+=("${found[@]}"); fi
done

for permission in "${optional[@]}"; do echo "::warning::the token lacks $permission"; done
if [ "${#required[@]}" -gt 0 ]; then
  for permission in "${required[@]}"; do echo "::error::the token lacks $permission"; done
  exit 1
fi

case "$kind:$name" in
  *:) echo "::error::project $PROJECT_REF has no name"; exit 1 ;;
  staging:*-staging) echo "Deploying to $name ($PROJECT_REF)" ;;
  staging:*) echo "::error::project $PROJECT_REF is '$name', not a staging project"; exit 1 ;;
  production:*-staging) echo "::error::project $PROJECT_REF is '$name', a staging project"; exit 1 ;;
  production:*) echo "Deploying to $name ($PROJECT_REF)" ;;
  *) echo "::error::unknown kind $kind"; exit 1 ;;
esac
