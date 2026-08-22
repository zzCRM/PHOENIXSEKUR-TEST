# Déploiement Phoenix Sekur sur OVH

Guide pour mettre en production sur **`https://app.votredomaine.fr`**.

## Coût estimé

| Poste | Prix |
|-------|------|
| VPS OVH Value (4 Go RAM) | ~7–10 €/mois HT |
| Domaine `.fr` | ~10 €/an |
| SSL (Let's Encrypt) | Gratuit |
| **Total** | **~11 €/mois** |

---

## Étape 1 — Commander le VPS OVH

1. [ovh.com/manager](https://www.ovh.com/manager/) → **Bare Metal Cloud** → **VPS**
2. Choisir **VPS Value** ou **Starter** (minimum **4 Go RAM**)
3. Datacenter : **Gravelines** ou **Roubaix** (France)
4. OS : **Ubuntu 24.04**

Notez l’**IP publique** du serveur (ex: `51.xxx.xxx.xxx`).

---

## Étape 2 — Configurer le DNS

Dans la zone DNS de votre domaine (OVH ou ailleurs) :

```
Type    Sous-domaine    Cible
A       app             51.xxx.xxx.xxx   (IP du VPS)
```

Résultat : `app.phoenixsekur.com` → votre serveur.

---

## Étape 3 — Préparer le serveur

Connectez-vous en SSH :

```bash
ssh ubuntu@51.xxx.xxx.xxx
```

Installez Docker :

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Déconnectez/reconnectez SSH
```

Installez Git :

```bash
sudo apt install -y git gettext-base
```

---

## Étape 4 — Déployer l'application

```bash
git clone https://github.com/zzCRM/PHOENIXSEKUR-TEST.git
cd PHOENIXSEKUR-TEST

# Configurer l'environnement
cp .env.production.example .env.production
nano .env.production   # Éditez DOMAIN, mots de passe, email
```

**Important dans `.env.production` :**
- `DOMAIN=app.phoenixsekur.com` (votre sous-domaine)
- `POSTGRES_PASSWORD=` → mot de passe fort unique
- `JWT_SECRET=` → `openssl rand -hex 32`
- `ADMIN_PASSWORD=` → mot de passe admin prod

Lancez le déploiement :

```bash
chmod +x scripts/deploy-ovh.sh
./scripts/deploy-ovh.sh
```

---

## Étape 5 — Importer vos données

Si vous avez des CSV Base44 :

```bash
docker compose -f docker-compose.prod.yml exec backend node scripts/migrate-csv.js /imports
docker compose -f docker-compose.prod.yml exec backend npm run fix:company-ids
```

---

## Étape 6 — Vérifier

Ouvrez **https://app.phoenixsekur.com/login**

- Email : celui défini dans `ADMIN_EMAIL`
- Mot de passe : celui défini dans `ADMIN_PASSWORD`

---

## Commandes utiles

```bash
# Voir les logs
docker compose -f docker-compose.prod.yml logs -f

# Redémarrer
docker compose -f docker-compose.prod.yml restart

# Mettre à jour (après git pull)
git pull && ./scripts/deploy-ovh.sh

# Sauvegarde BDD
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U phoenix phoenixsekur > backup-$(date +%Y%m%d).sql
```

---

## Architecture production

```
Internet
   │
   ▼
Caddy (:443 HTTPS)
   ├── /api/*      → Backend Node.js (:3001)
   ├── /uploads/*  → Backend (fichiers)
   └── /*          → Frontend React (Nginx)
                        │
                   PostgreSQL (interne)
```

---

## Couper Base44

Une fois la prod OVH validée (1–2 semaines de test parallèle) :

1. Export final des données Base44 (CSV)
2. Import sur OVH
3. Communiquer la nouvelle URL à l'équipe
4. Résilier l'abonnement Base44

---

## Invitations par email (SMTP)

Quand un administrateur invite un utilisateur, Phoenix Sekur envoie un email avec un lien du type :

`https://app.phoenixsekur.com/invitation/xxxxx`

L'invité clique, choisit son mot de passe, et son compte est créé.

Ajoutez ces variables dans `/opt/phoenixsekur/.env.production` :

```env
SMTP_HOST=ssl0.ovh.net
SMTP_PORT=465
SMTP_USER=noreply@votredomaine.fr
SMTP_PASS=mot-de-passe-boite-mail
SMTP_FROM=Phoenix Sekur <noreply@votredomaine.fr>
```

Puis redéployez :

```bash
cd /opt/phoenixsekur && sudo bash scripts/deploy-ovh.sh
```

Sans SMTP configuré, l'invitation est créée mais le lien s'affiche dans l'interface admin (à transmettre manuellement).

---

## Support

- Logs backend : `docker compose -f docker-compose.prod.yml logs backend`
- Logs Caddy (SSL) : `docker compose -f docker-compose.prod.yml logs caddy`
- Repo : [github.com/zzCRM/PHOENIXSEKUR-TEST](https://github.com/zzCRM/PHOENIXSEKUR-TEST)
