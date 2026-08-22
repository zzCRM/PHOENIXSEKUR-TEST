#!/bin/bash
# Corrige SUPER_ADMIN_EMAILS et sépare admin plateforme / admin société
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

# Retirer serviceclient de SUPER_ADMIN_EMAILS s'il y est (admin société, pas plateforme)
if grep -q "^SUPER_ADMIN_EMAILS=" "$ENV_FILE" 2>/dev/null; then
  sed -i 's/^SUPER_ADMIN_EMAILS=.*/SUPER_ADMIN_EMAILS=admin@phoenixsekur.fr/' "$ENV_FILE" 2>/dev/null || \
  sed -i '' 's/^SUPER_ADMIN_EMAILS=.*/SUPER_ADMIN_EMAILS=admin@phoenixsekur.fr/' "$ENV_FILE" 2>/dev/null || true
fi

ensure_var COMPANY_ADMIN_EMAILS "serviceclient@ppsecurity.fr,contact@ppsecurity.fr"
ensure_var ADMIN_EMAIL "admin@phoenixsekur.fr"
ensure_var ADMIN_ROLE "superadmin"
