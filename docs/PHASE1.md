# Phase 1 — Indépendance Base44 (fondations)

Migration Phoenix Sekur vers stack autonome : **React + Node.js + PostgreSQL**.

## Architecture

```
base44-export/     → Frontend React (ex-Base44)
backend/           → API Node.js + Express + Prisma
docker-compose.yml → PostgreSQL (prod/dev)
```

## Démarrage rapide

### 1. Base de données

**Option A — Docker :**
```bash
docker compose up -d postgres
```

**Option B — PostgreSQL local :**
```bash
# Créer user + base (une fois)
sudo -u postgres createuser phoenix -P   # mot de passe: phoenix_dev
sudo -u postgres createdb phoenixsekur -O phoenix
```

### 2. Backend

```bash
cd backend
cp .env.example .env    # adapter si besoin
npm install
npx prisma db push
npm run seed:admin      # crée admin@phoenixsekur.fr
npm run db:seed         # importe les CSV
npm run dev             # → http://localhost:3001
```

**Compte admin par défaut :**
- Email : `admin@phoenixsekur.fr`
- Mot de passe : `Phoenix2026!`

### 3. Frontend (mode autonome)

```bash
cd base44-export
# .env.local doit contenir :
# VITE_USE_OWN_API=true
# VITE_API_URL=http://localhost:3001

npm install
npm run dev             # → http://localhost:5173
```

Connexion sur **http://localhost:5173/login**

## Variables d'environnement

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret pour tokens auth |
| `PORT` | Port API (default 3001) |
| `CORS_ORIGIN` | URL frontend |
| `ADMIN_EMAIL` | Email admin initial |
| `ADMIN_PASSWORD` | Mot de passe admin initial |

### Frontend (`base44-export/.env.local`)

| Variable | Description |
|----------|-------------|
| `VITE_USE_OWN_API=true` | Active le mode autonome (sans Base44) |
| `VITE_API_URL` | URL du backend |

## API endpoints

| Route | Description |
|-------|-------------|
| `POST /api/auth/login` | Connexion |
| `GET /api/auth/me` | Utilisateur courant |
| `GET /api/entities/:name?q={...}` | Liste/filtre (compatible Base44) |
| `POST /api/entities/:name` | Création |
| `PUT /api/entities/:name/:id` | Mise à jour |
| `DELETE /api/entities/:name/:id` | Suppression |

## Données importées (CSV)

| Entité | Enregistrements |
|--------|-----------------|
| Client | 1 |
| CompanySettings | 2 |
| Site | 1 |
| Mission | 2 |
| Invoice | 3 |
| Demande | 1 |

## Prochaines phases

- **Phase 2** : Modules essentiels (Agents, Planning, Missions) — tests complets
- **Phase 3** : Facturation, Main courante, Demandes
- **Phase 4** : Rondes NFC, Géoloc, Documents
- **Phase 5** : Hébergement production + coupure Base44

## Pour une agence (maintenance future)

- Code : monorepo GitHub `zzCRM/PHOENIXSEKUR-TEST`
- Stack : Node 20, PostgreSQL 16, React 18, Vite 6, Prisma 6
- Lancer tests : `cd backend && npm run dev` + `cd base44-export && npm run dev`
- Schéma BDD : `backend/prisma/schema.prisma`
- Entités métier : `base44-export/base44/entities/*.jsonc`
