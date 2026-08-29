#!/bin/bash
# Ajoute les variables vitrine/cookie dans .env.production si absentes
set -euo pipefail
ENV_FILE="${1:-.env.production}"
[ -f "$ENV_FILE" ] || exit 0

ensure_var() {
  local key="$1"
  local val="$2"
  if ! grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}

ensure_var VITRINE_DOMAIN "www.phoenixsekur.com"
ensure_var ROOT_DOMAIN "phoenixsekur.com"
ensure_var VITRINE_URL "https://www.phoenixsekur.com"
ensure_var COOKIE_DOMAIN ".phoenixsekur.com"
