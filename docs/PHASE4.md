# Phase 4 — Rondes NFC, Géoloc, Documents, RH

## Modules stabilisés

| Module | Fonctions |
|--------|-----------|
| **Rondes** | CRUD tournées, points de contrôle NFC |
| **Points de contrôle** | Gestion checkpoints par site |
| **Carte temps réel** | Supervision agents (géoloc + prises de service) |
| **Documents** | Upload, liste, export PDF |
| **Gestion RH** | Prêts matériel, fiches de paie |
| **Congés** | Demandes, approbation/refus |

## Corrections Phase 4

- **Rondes** : `company_id` ajouté à la création
- **Tri géoloc** : support `-timestamp` amélioré
- **Données exemple** : script `seed:phase4`

## Script seed

```bash
cd backend
npm run seed:phase4
```

Crée :
- 1 ronde TENNECO avec 3 points NFC
- 2 positions géolocalisation (carte temps réel)
- 1 document, 1 congé, 1 prêt matériel, 1 fiche de paie
- 1 prise de service + 1 exécution ronde

## Tester

1. **Rondes** → voir « Ronde nocturne TENNECO » + créer une ronde
2. **Points de contrôle** → gérer les checkpoints
3. **Carte temps réel** → voir agent Jean Dupont sur la carte
4. **Documents** → upload un fichier PDF
5. **Gestion RH** → prêts matériel + fiches de paie
6. **Congés** → approuver/refuser une demande

## NFC (mobile)

Le scan NFC fonctionne sur **Chrome Android** avec tags NFC physiques.
Sur desktop : saisie manuelle du tag ID dans les formulaires.

## Prochaine étape — Phase 5

- Déploiement production (serveur + domaine)
- Coupure Base44 définitive
- Emails (invitations, rapports)
