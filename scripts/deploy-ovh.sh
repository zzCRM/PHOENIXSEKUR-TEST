#!/bin/bash
# Déploiement Phoenix Sekur sur VPS OVH
# Usage: ./scripts/deploy-ovh.sh
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env.production ]; then
  echo "❌ Fichier .env.production manquant."
  echo "   cp .env.production.example .env.production"
  echo "   Puis éditez les mots de passe et le domaine."
  exit 1
fi

set -a
source .env.production
set +a

echo "🚀 Déploiement Phoenix Sekur..."
echo "   App    : https://${DOMAIN}"
echo "   Vitrine: https://${VITRINE_DOMAIN:-www.phoenixsekur.com}"

# Config vitrine (URL app injectée)
sed "s|__APP_URL__|https://${DOMAIN}|g" vitrine/public/config.js > vitrine/public/config.runtime.js
mv vitrine/public/config.runtime.js vitrine/public/config.js

# Générer Caddyfile depuis le template
export VITRINE_DOMAIN="${VITRINE_DOMAIN:-www.phoenixsekur.com}"
export ROOT_DOMAIN="${ROOT_DOMAIN:-phoenixsekur.com}"
bash scripts/ensure-vitrine-env.sh .env.production 2>/dev/null || true
envsubst '${DOMAIN} ${VITRINE_DOMAIN} ${ROOT_DOMAIN} ${ACME_EMAIL}' < Caddyfile.template > Caddyfile

docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

echo ""
echo "⏳ Attente démarrage (40s)..."
sleep 40

if docker compose -f docker-compose.prod.yml --env-file .env.production exec -T backend wget -qO- http://localhost:3001/health 2>/dev/null | grep -q ok; then
  echo "✅ Backend OK"
else
  echo "⚠️  Backend en erreur — logs:"
  docker compose -f docker-compose.prod.yml --env-file .env.production logs backend --tail 40
fi

echo ""
echo "✅ Déployé !"
echo ""
echo "📋 Checklist:"
echo "  1. DNS IONOS:"
echo "       A  app  →  IP du VPS"
echo "       A  www  →  IP du VPS"
echo "       A  @    →  IP du VPS  (phoenixsekur.com)"
echo "  2. Attendre propagation DNS (15 min - 2 h)"
echo "  3. Vitrine : https://${VITRINE_DOMAIN:-www.phoenixsekur.com}"
echo "  4. App     : https://${DOMAIN}/login"
echo ""
echo "Import CSV Base44:"
echo "  docker compose -f docker-compose.prod.yml --env-file .env.production exec backend node scripts/migrate-csv.js /imports"
