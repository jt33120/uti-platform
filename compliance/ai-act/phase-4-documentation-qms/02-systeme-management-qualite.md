# Système de management de la qualité — QMS (Art. 17)

> Statut : 🟥 À FAIRE · Responsable : Conformité · Dernière mise à jour : 2026-06-17
> Article AI Act : Art. 17

Le QMS est l'ensemble des **procédures documentées** garantissant que le système
reste conforme dans la durée. Proportionné à la taille d'UTI Group (< 11 salariés).

## 1. Procédures à documenter

| Procédure | Contenu | Référence | Statut |
|-----------|---------|-----------|--------|
| Conception & développement | Standards de dev, revue de code, gestion des features de scoring | [architecture hybride](../phase-3-technique/02-spec-architecture-hybride.md) | 🟥 |
| Gestion des données | Qualité, pertinence, biais | [gouvernance des données](../phase-2-risques-donnees/02-gouvernance-donnees.md) | 🟥 |
| Gestion des risques | Registre, revue trimestrielle | [gestion des risques](../phase-2-risques-donnees/01-systeme-gestion-risques.md) | 🟥 |
| Gestion des modifications | Tout changement de modèle/grille déclenche tests + réévaluation risques + MAJ doc | ci-dessous | 🟥 |
| Tests & validation | Unitaires, biais, non-régression | [plan de test de biais](../phase-2-risques-donnees/03-plan-test-biais.md) | 🟥 |
| Journalisation | Audit log | [journalisation](../phase-3-technique/03-spec-journalisation.md) | 🟥 |
| Surveillance post-marché | _Phase 6_ | — | 🟥 |
| Gestion des incidents | _Phase 6_ (Art. 73) | — | 🟥 |
| Communication aux autorités | Procédure de réponse à la surveillance de marché | [À COMPLÉTER] | 🟥 |

## 2. Procédure de gestion des modifications (clé)

Toute modification **significative** (changement de modèle LLM, de la grille de
scoring, des seuils, du périmètre) suit ce circuit :

1. **Demande de changement** documentée (qui, quoi, pourquoi).
2. **Évaluation d'impact** : risques (Art. 9), biais (Art. 10), reproductibilité.
3. **Tests** : unitaires + biais + non-régression.
4. **Mise à jour** du dossier technique Annexe IV et de la notice.
5. **Validation** par le responsable conformité.
6. **Versionnage** (grid_version / model_version dans les logs).

## 3. Responsabilités & ressources

| Rôle | Personne |
|------|----------|
| Pilote QMS | [À COMPLÉTER : responsable conformité] |
| Revue qualité dev | [À COMPLÉTER : lead dev] |
| Supervision DPO | Sullyvan BIJON |

## 4. Audit interne

- [ ] Revue annuelle du QMS (procédures à jour, écarts, plan d'action).
- [ ] Conservation des preuves de revue.
