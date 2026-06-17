# Système de gestion des risques (Art. 9)

> Statut : 🟥 À FAIRE · Responsable : Conformité · Dernière mise à jour : 2026-06-17
> Article AI Act : Art. 9

## 1. Principe

Processus **continu et itératif** sur tout le cycle de vie du système :
identification des risques → estimation → mesures de réduction → évaluation du
risque résiduel → réévaluation périodique.

## 2. Registre des risques

| ID | Risque | Source | Gravité | Probabilité | Mesures de réduction | Risque résiduel | Statut |
|----|--------|--------|---------|-------------|----------------------|-----------------|--------|
| R1 | **Biais discriminatoire** (genre/âge/origine via nom & texte libre) | Données d'entrée + LLM | Élevée | Moyenne | Pseudonymisation entrée LLM ; scoring déterministe ; test de biais | Moyen | 🟧 |
| R2 | **Score non reproductible** (température > 0) | Modèle | Moyenne | Élevée | `temperature=0` ; scoring déterministe ; versionnage modèle | Faible | 🟧 |
| R3 | **Décision sur-automatisée** (override cosmétique) | Usage | Élevée | Moyenne | Champ override + justification ; politique d'usage ; révision humaine | Faible | 🟥 |
| R4 | **Fuite de données personnelles** (CV) | Stockage/transport | Élevée | Faible | Bucket privé + URLs signées ; RLS deny-all ; clés service_role | Faible | 🟩 |
| R5 | **Hallucination du LLM** (compétences inventées) | Modèle | Moyenne | Moyenne | Extraction structurée vérifiable ; scoring sur features ; supervision | Moyen | 🟥 |
| R6 | **Transfert hors UE non encadré** (OpenRouter/Anthropic) | Sous-traitance | Élevée | Moyenne | DPA + garanties de transfert ; pseudonymisation | Moyen | 🟧 |
| R7 | **Manque d'auditabilité** (logs incomplets) | Conception | Élevée | Élevée | Journalisation Art. 12 complète | Faible | 🟥 |
| R8 | **Indisponibilité / robustesse** | Infrastructure | Moyenne | Faible | Gestion d'erreurs, fallback, monitoring | Faible | 🟧 |
| R9 | **Dérive vers une pratique interdite** (Art. 5, inférence émotionnelle) | Évolution produit | Critique | Faible | Garde-fou de conception ; revue de toute évolution | Faible | 🟧 |

## 3. Méthode d'estimation

- **Gravité** : Faible / Moyenne / Élevée / Critique (impact sur les droits des personnes).
- **Probabilité** : Faible / Moyenne / Élevée.
- **Risque résiduel** : après mesures. Aucun risque résiduel **Critique** ne doit subsister.

## 4. Cycle de revue

| Déclencheur | Action |
|-------------|--------|
| Changement de modèle IA | Réévaluation complète |
| Changement de la grille de scoring | Réévaluation R1, R2, R5 |
| Incident | Réévaluation du risque concerné + Art. 73 si grave |
| Périodicité | Revue **trimestrielle** du registre |

## 5. Responsables

| Rôle | Personne |
|------|----------|
| Propriétaire du registre | [À COMPLÉTER : responsable conformité] |
| Contributeurs | Dev, DPO |
