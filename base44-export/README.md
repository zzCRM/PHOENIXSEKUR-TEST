# Phoenix Sekur — frontend

Ce dossier est le contexte de construction du frontend. Il appelle exclusivement l'API Phoenix (`/api`).

## Développement local

```bash
npm ci
npm run dev
```

Le serveur de développement proxifie `/api` et `/uploads` vers `VITE_API_URL`, ou vers `http://localhost:3001` si cette variable est absente.

L'API et PostgreSQL se lancent séparément, depuis le dossier `backend`.
