# Phase 2 — Modules essentiels

Stabilisation CRUD pour **Agents, Clients, Sites, Missions, Planning**.

## Nouveautés Phase 2

### Backend
- **Upload fichiers** : `POST /api/files/upload` → logos, photos (stockés dans `backend/uploads/`)
- **Invitation utilisateurs** : `POST /api/users/invite` → crée un compte avec mot de passe temporaire
- **Tri amélioré** : support `-created_date`, `-date` (missions), filtres JSON
- **CRUD** : création avec `company_id` automatique depuis le token JWT

### Frontend (phoenixClient)
- `base44.users.inviteUser()` → API autonome
- `base44.integrations.Core.UploadFile()` → upload local
- `base44.functions.invoke('getGoogleMapsApiKey')` → compatible Google Maps
- Proxy `/uploads` → backend

## Modules testés

| Module | CRUD | Upload | Invite |
|--------|------|--------|--------|
| Clients | ✅ | ✅ logo | ✅ portail |
| Sites | ✅ | ✅ photo | — |
| Agents | ✅ | ✅ photo | ✅ compte |
| Missions | ✅ | — | — |
| Planning | ✅ | — | — |

## Tester Phase 2

```bash
# Backend (terminal 1)
cd backend && npm run dev

# Frontend (terminal 2)
cd base44-export && npm run dev
```

1. Login → http://localhost:5173/login
2. **Clients** → créer / modifier / supprimer un client
3. **Sites** → créer un site lié à un client
4. **Agents** → créer un collaborateur
5. **Missions** → créer une mission
6. **Planning** → voir les vacations sur le calendrier

## Invitation agent (onglet Compte)

Quand tu invites un agent par email :
- Un compte est créé avec un **mot de passe temporaire**
- Affiché dans les logs backend (envoi email = Phase 5)
- L'agent se connecte sur `/login` avec ce mot de passe

## Prochaine étape — Phase 3

- Facturation (PDF)
- Main courante
- Demandes & Alertes
