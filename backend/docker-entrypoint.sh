#!/bin/sh
set -e
echo "=== Phoenix Sekur API — démarrage ==="
echo "DATABASE_URL=${DATABASE_URL%%@*}@***"

echo "→ prisma db push..."
npx prisma db push

echo "→ seed admin..."
node scripts/seed-admin.js 2>/dev/null || true

echo "→ correction rôles admin société..."
node scripts/fix-company-admin-roles.js 2>/dev/null || true

echo "→ isolation multi-tenant (plateforme)..."
node scripts/migrate-platform-isolation.js 2>/dev/null || true

echo "→ démarrage serveur..."
exec node src/index.js
