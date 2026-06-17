# Plan de test de biais

> Statut : 🟥 À FAIRE · Responsable : Data / Dev · Dernière mise à jour : 2026-06-17
> Articles AI Act : Art. 10 (biais), Art. 15 (exactitude)

## 1. Objectif

Démontrer, preuves à l'appui, que le scoring ne produit pas de **discrimination
indirecte** selon le genre, l'âge ou l'origine. C'est le livrable que la
surveillance de marché examine en priorité sur l'emploi.

## 2. Méthode — test par permutation (counterfactual)

Principe : prendre un même CV et **faire varier uniquement un attribut sensible**
(prénom masculin/féminin, prénom à consonance différente, dates d'âge), puis
vérifier que le **score reste stable**.

| Test | Variable permutée | Attendu |
|------|-------------------|---------|
| T1 — Genre | Prénom M ↔ F, civilité | Écart de score ≤ seuil [À COMPLÉTER, ex. 2 pts] |
| T2 — Âge | Décalage des dates (±15 ans) | Écart ≤ seuil, hors effet séniorité légitime |
| T3 — Origine | Nom/prénom à consonance variée | Écart ≤ seuil |
| T4 — Reproductibilité | Même entrée, 5 exécutions | Score identique (déterministe) |

## 3. Jeu de test

- **Constitution** : CV synthétiques ou anonymisés, couvrant plusieurs métiers et
  niveaux. [À COMPLÉTER : taille du jeu, ex. ≥ 50 profils × variantes].
- **Aucune donnée réelle non consentie** ne doit servir au test.
- **Versionné** dans le dossier technique (Annexe IV).

## 4. Métriques

| Métrique | Définition | Seuil d'alerte |
|----------|------------|----------------|
| Écart de score moyen par variante | moyenne(|score_A − score_B|) | [À COMPLÉTER] |
| Taux d'inversion de rang | % de cas où le rang change après permutation | [À COMPLÉTER] |
| Stabilité (T4) | variance des scores à entrée constante | 0 (déterministe attendu) |

## 5. Comparatif avant/après architecture hybride

Exécuter la batterie **deux fois** :
1. Sur le moteur **actuel** (LLM scoring direct) → établir la base.
2. Sur le moteur **hybride** (extraction LLM + scoring déterministe) → démontrer
   l'amélioration. C'est une preuve forte de mesure corrective (Art. 10).

## 6. Restitution

- [ ] Rapport de test daté et versionné
- [ ] Décision : conforme / mesures correctives supplémentaires
- [ ] Réexécution à chaque changement de modèle ou de grille

## 7. Implémentation

Le harnais de test sera un script reproductible (à ajouter sous
`backend/tests/bias/` en Phase 3). Voir
[spec architecture hybride](../phase-3-technique/02-spec-architecture-hybride.md).
