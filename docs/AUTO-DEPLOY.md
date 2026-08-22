# Mises à jour automatiques (sans KVM)

Comme sur **Base44** ou **Phoenix CRM via Cursor** : le code est poussé sur GitHub → le serveur se met à jour **tout seul**.

## Pourquoi KVM avant ?

| Phoenix CRM (Base44) | Phoenix Sekur (OVH) |
|----------------------|---------------------|
| Hébergé par Base44 | Hébergé sur **votre** VPS privé |
| Cursor/Base44 publie directement | Personne ne poussait le code sur le serveur |
| Vous ne voyiez rien | Il fallait `git pull` à la main |

**Cursor modifie toujours le code sur GitHub.**  
La différence : Base44 déployait pour vous. Sur OVH, il manquait le **pont automatique** GitHub → VPS.

## Configuration unique (10 min, une seule fois)

### 1. Créer une clé SSH de déploiement (sur Mac/iPad Termius ou KVM)

```bash
ssh-keygen -t ed25519 -C "github-deploy-phoenix" -f ~/.ssh/phoenix_deploy -N ""
cat ~/.ssh/phoenix_deploy.pub
```

### 2. Autoriser la clé sur le VPS

```bash
# Connecté au VPS en ubuntu :
echo "COLLER_LA_CLE_PUBLIQUE_ICI" >> ~/.ssh/authorized_keys
```

### 3. Ajouter les secrets GitHub

Repo **zzCRM/PHOENIXSEKUR-TEST** → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Secret | Valeur |
|--------|--------|
| `VPS_HOST` | `51.91.251.149` |
| `VPS_USER` | `ubuntu` |
| `VPS_SSH_KEY` | contenu de `~/.ssh/phoenix_deploy` (clé **privée**) |

### 4. Merger la PR ou pousser sur `main`

Dès qu’on pousse du code → **GitHub Actions déploie sur OVH** en ~5 min.

Vous verrez l’avancement : **GitHub** → onglet **Actions**.

## Après ça

- **Vous** : rien à faire sur OVH
- **Moi (Cursor)** : je code → push GitHub → déploiement auto
- **KVM** : uniquement si le serveur plante (rare)

C’est exactement le même principe que Phoenix CRM sur Base44.
