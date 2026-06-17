# Spécification — Architecture hybride (extraction LLM / scoring déterministe)

> Statut : 🟥 À FAIRE · Responsable : Dev · Dernière mise à jour : 2026-06-17
> Articles AI Act : Art. 10 (biais), Art. 13 (transparence), Art. 15 (reproductibilité)

## 1. Objectif

Séparer **ce que fait le génératif** (lire/normaliser un CV) de **ce qui décide le
score** (calcul déterministe). Bénéfices : reproductibilité, explicabilité,
auditabilité, atténuation des biais — et réduction du périmètre « boîte noire ».

## 2. État actuel (à refondre)

`backend/services/ai_matching.py` envoie au LLM **l'AO + le CV brut + le nom** et
demande au modèle de **produire directement le score** (`temperature=0.2`). Le
score est donc une inférence non reproductible et non auditable.

## 3. Architecture cible

```
CV (PDF→texte)
   │
   ▼
[ ÉTAPE 1 — EXTRACTION par LLM ]         ← génératif, sortie JSON stricte
   • compétences normalisées (liste)
   • années d'expérience
   • secteurs/contextes
   • (TJM/nom NON nécessaires au LLM → exclus)
   │
   ▼
features structurées (pseudonymisées : aucun nom/contact)
   │
   ▼
[ ÉTAPE 2 — SCORING DÉTERMINISTE en Python ]   ← aucune IA, 100% reproductible
   • compétences (40) = recouvrement skills_required ∩ skills
   • séniorité (20)   = f(experience_years vs requis)
   • contexte (20)    = mapping secteur (ou similarité bornée et étiquetée)
   • TJM (20)         = f(tjm vs budget_max)
   • total, breakdown, recommandation, rang
   │
   ▼
[ ÉTAPE 3 — DÉCISION HUMAINE ] (override + justification, Art. 14)
```

## 4. Découpage du code

| Fichier | Avant | Après |
|---------|-------|-------|
| `services/ai_matching.py` | Extraction + scoring mêlés | **`extract_features(cv_text) -> Features`** (LLM, JSON strict) |
| `services/scoring.py` *(nouveau)* | — | **`score_consultant(features, ao) -> Score`** (déterministe, testable) |
| `services/matching_runner.py` | Appelle le scoring LLM | Orchestration extraction → scoring → persistance |

## 5. Détail du scoring déterministe (grille 40/20/20/20)

> Les formules ci-dessous sont une **proposition** à valider par le métier (les
> seuils sont des paramètres explicites, versionnés).

- **Compétences (0–40)** : `40 * |skills_required ∩ skills| / |skills_required|`
  (normalisation casse/synonymes via la liste extraite).
- **Séniorité (0–20)** : paliers sur `experience_years` vs niveau requis de l'AO.
- **Contexte (0–20)** : table de correspondance secteur AO ↔ secteurs du parcours ;
  à défaut, similarité d'embeddings **bornée et explicitement étiquetée** comme
  composante assistée.
- **TJM (0–20)** : `20` si `tjm ≤ budget_max`, dégressif au-delà (barème explicite).
- **Total** = somme ; **recommandation** : FORT ≥ [X], MOYEN ≥ [Y], sinon FAIBLE
  ([À COMPLÉTER : seuils]).

## 6. Pseudonymisation (Art. 10 + RGPD)

- L'étape 1 reçoit le **texte du CV nettoyé** ; nom/e-mail/téléphone retirés avant
  envoi au LLM (regex + champ structuré séparé).
- L'identité est **réattachée après** le scoring, côté base, jamais exposée au modèle.

## 7. Reproductibilité (Art. 15)

- LLM d'extraction : `temperature=0`, modèle **figé et versionné**.
- Scoring : pur Python, **déterministe** → testable unitairement.

## 8. Tests

- [ ] Tests unitaires de `score_consultant` (cas limites : 0 compétence, TJM hors budget…).
- [ ] Harnais de biais (`backend/tests/bias/`) — voir
      [plan de test de biais](../phase-2-risques-donnees/03-plan-test-biais.md).
- [ ] Test de non-régression vs moteur actuel (corrélation des classements).

## 9. Compatibilité

La table `matchings` reste compatible (mêmes champs : `score_total`, `breakdown`,
`points_forts/faibles`, `recommandation`, `rank`). L'UX ne change pas ; seul le
moteur change.

## 10. Décisions à acter avant implémentation

- [ ] Seuils FORT/MOYEN/FAIBLE
- [ ] Barème séniorité et TJM
- [ ] Source de la table secteurs (contexte) ou embeddings
