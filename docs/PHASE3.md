# Phase 3 — Facturation, Main courante, Demandes, Alertes

## Modules stabilisés

| Module | Fonctions |
|--------|-----------|
| **Facturation** | CRUD factures, export PDF, stats encaissé/en attente |
| **Main courante** | Saisie manuelle, export PDF, fusion événements auto |
| **Demandes** | Création, réponse, changement statut |
| **Alertes** | Liste temps réel, filtres, marquer lu / tout marquer lu |

## Corrections Phase 3

- **Factures importées** : `company_id` corrigé (était `default` → ID société)
- **Main courante** : `company_id` ajouté à la création
- **Données exemple** : script `seed:phase3` pour tester

## Scripts backend

```bash
cd backend

# Corriger les company_id des imports CSV
npm run fix:company-ids

# Ajouter données exemple Phase 3
npm run seed:phase3
```

## Tester

1. Login → http://localhost:5173/login
2. **Facturation** → voir 3 factures importées + créer une nouvelle + PDF
3. **Main courante** → ajouter une entrée + export PDF
4. **Demandes** → répondre à une demande, changer le statut
5. **Alertes** → voir les alertes, marquer comme lues

## Données exemple (seed:phase3)

- 2 alertes (prise de service + incident)
- 1 entrée main courante TENNECO
- 1 demande client planning

## Prochaine étape — Phase 4

- Rondes NFC
- Géolocalisation temps réel
- Documents & RH
