#!/bin/bash
# Met à jour .env.production avec les variables SMTP (idempotent).
# Appelé automatiquement par GitHub Actions — pas d'action manuelle sur le VPS.
set -euo pipefail

ENV_FILE="${1:-.env.production}"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Fichier introuvable: $ENV_FILE"
  exit 1
fi

python3 - "$ENV_FILE" <<'PY'
import os
import re
import sys

path = sys.argv[1]
keys = {
    "SMTP_HOST": os.environ.get("SMTP_HOST", "smtp.ionos.fr"),
    "SMTP_PORT": os.environ.get("SMTP_PORT", "587"),
    "SMTP_USER": os.environ.get("SMTP_USER", "contact@phoenixsekur.com"),
    "SMTP_PASS": os.environ.get("SMTP_PASS", ""),
    "SMTP_FROM": os.environ.get("SMTP_FROM", "Phoenix Sekur <contact@phoenixsekur.com>"),
}

content = open(path, encoding="utf-8").read()

for key, val in keys.items():
    if key == "SMTP_PASS" and not val:
        continue
    line = f'{key}={val}'
    pattern = rf"^{re.escape(key)}=.*$"
    if re.search(pattern, content, flags=re.M):
        content = re.sub(pattern, line, content, flags=re.M)
    else:
        if not content.endswith("\n"):
            content += "\n"
        content += line + "\n"

open(path, "w", encoding="utf-8").write(content)
print(f"✅ SMTP configuré dans {path} ({keys['SMTP_USER']})")
PY
