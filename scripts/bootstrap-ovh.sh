#!/bin/bash
# Installation automatique Phoenix Sekur sur VPS OVH (Ubuntu 24.04)
# Usage (sur le VPS, en root ou avec sudo) :
#   curl -fsSL https://raw.githubusercontent.com/zzCRM/PHOENIXSEKUR-TEST/cursor/migrate-off-base44-6bc2/scripts/bootstrap-ovh.sh | sudo bash
set -euo pipefail

REPO="https://github.com/zzCRM/PHOENIXSEKUR-TEST.git"
BRANCH="cursor/migrate-off-base44-6bc2"
INSTALL_DIR="/opt/phoenixsekur"
DOMAIN="${DOMAIN:-app.phoenixsekur.com}"
ACME_EMAIL="${ACME_EMAIL:-admin@phoenixsekur.fr}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@phoenixsekur.fr}"

echo "═══════════════════════════════════════════"
echo "  Phoenix Sekur — Installation automatique"
echo "  Domaine: ${DOMAIN}"
echo "═══════════════════════════════════════════"

# ─── Docker ────────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "📦 Installation Docker..."
  apt-get update -qq
  apt-get install -y -qq git gettext-base curl
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
else
  echo "✅ Docker déjà installé"
  apt-get install -y -qq git gettext-base 2>/dev/null || true
fi

# ─── Clone repo ────────────────────────────────────────────────────────────
if [ -d "$INSTALL_DIR/.git" ]; then
  echo "📥 Mise à jour du code..."
  cd "$INSTALL_DIR"
  git fetch origin "$BRANCH"
  git checkout "$BRANCH"
  git pull origin "$BRANCH"
else
  echo "📥 Clonage du repo..."
  rm -rf "$INSTALL_DIR"
  git clone -b "$BRANCH" "$REPO" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# ─── Secrets ───────────────────────────────────────────────────────────────
if [ ! -f .env.production ]; then
  POSTGRES_PASSWORD=$(openssl rand -hex 16)
  JWT_SECRET=$(openssl rand -hex 32)
  ADMIN_PASSWORD=$(openssl rand -base64 12 | tr -d '/+=' | head -c 16)

  cat > .env.production <<EOF
DOMAIN=${DOMAIN}
ACME_EMAIL=${ACME_EMAIL}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
JWT_SECRET=${JWT_SECRET}
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
ADMIN_COMPANY_ID=69edb44339460eb505c2a699
GOOGLE_MAPS_API_KEY=
EOF

  echo ""
  echo "🔐 Identifiants générés (NOTEZ-LES MAINTENANT) :"
  echo "   URL      : https://${DOMAIN}/login"
  echo "   Email    : ${ADMIN_EMAIL}"
  echo "   Password : ${ADMIN_PASSWORD}"
  echo ""
  cp .env.production /root/phoenixsekur-credentials.txt 2>/dev/null || \
    cp .env.production ~/phoenixsekur-credentials.txt 2>/dev/null || true
  echo "   Sauvegardé dans ~/phoenixsekur-credentials.txt"
  echo ""
else
  echo "✅ .env.production existant — conservé"
  source .env.production
  ADMIN_EMAIL="${ADMIN_EMAIL:-admin@phoenixsekur.fr}"
fi

# ─── Deploy ────────────────────────────────────────────────────────────────
chmod +x scripts/deploy-ovh.sh
./scripts/deploy-ovh.sh

# ─── Import CSV ────────────────────────────────────────────────────────────
echo ""
echo "📊 Import des données Base44..."
docker compose -f docker-compose.prod.yml exec -T backend node scripts/migrate-csv.js /imports || true
docker compose -f docker-compose.prod.yml exec -T backend npm run fix:company-ids || true

echo ""
echo "═══════════════════════════════════════════"
echo "  ✅ Installation terminée !"
echo "  → https://${DOMAIN}/login"
echo "═══════════════════════════════════════════"
