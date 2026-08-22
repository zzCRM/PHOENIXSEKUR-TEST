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

echo "🚀 Déploiement Phoenix Sekur sur https://${DOMAIN}..."

# Générer Caddyfile depuis le template
envsubst '${DOMAIN} ${ACME_EMAIL}' < Caddyfile.template > Caddyfile

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
echo "  1. DNS chez OVH:  A   app  →  IP de ce VPS"
echo "  2. Attendre 15 min - 2h (propagation DNS)"
echo "  3. Ouvrir https://${DOMAIN}/login"
echo "  4. Login: ${ADMIN_EMAIL} / (mot de passe dans .env.production)"
echo ""
echo "Import CSV Base44:"
echo "  docker compose -f docker-compose.prod.yml --env-file .env.production exec backend node scripts/migrate-csv.js /imports"
