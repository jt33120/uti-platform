# Analyse d'impact relative à la protection des données (DPIA / AIPD)

> Statut : 🟧 EN COURS · Responsable : DPO (Sullyvan BIJON) · Dernière mise à jour : 2026-06-17
> Base : RGPD Art. 35 — **obligatoire** (profilage + évaluation systématique de personnes)

La DPIA est **cumulative** avec l'AI Act : elle ne remplace ni n'est remplacée par
la conformité haut risque. Elle est **due** car le traitement implique une
**évaluation systématique et automatisée** (scoring) de personnes physiques.

## 1. Description du traitement

| Champ | Valeur |
|-------|--------|
| Responsable de traitement | UTI Group |
| DPO | Sullyvan BIJON (interne) |
| Finalité | Présélection de consultants pour des AO via scoring IA |
| Personnes concernées | Consultants / freelances externes |
| Catégories de données | Identité, coordonnées, CV, compétences, expérience, TJM, score (donnée dérivée) |
| Données sensibles | En principe **non** scorées ; risque de mention indirecte dans le CV |
| Destinataires | Staff UTI, partenaires (restreint), sous-traitant IA (OpenRouter/Anthropic, hors UE) |
| Durée de conservation | [À COMPLÉTER — voir politique de conservation] |

## 2. Base légale

[À COMPLÉTER par le DPO — pistes] : consentement (Art. 6.1.a) du consultant et/ou
intérêt légitime encadré. Le **consentement** est privilégié vu le scoring IA et
le droit de refus offert.

## 3. Nécessité & proportionnalité

| Principe | Évaluation |
|----------|------------|
| Minimisation | **Pseudonymisation** de l'entrée LLM ; ne scorer que des features pertinentes |
| Limitation des finalités | Données utilisées uniquement pour le matching AO |
| Exactitude | Flow-down partenaires ; CV à jour |
| Limitation de conservation | Durées définies ([conservation](../phase-4-documentation-qms/03-politique-conservation.md)) |

## 4. Transfert hors UE (point d'attention majeur)

Le CV/features transitent par **OpenRouter → Anthropic** (hors UE).

- [ ] Identifier le pays et le mécanisme de transfert (clauses contractuelles types ?).
- [ ] Conclure/valider un **DPA** avec le(s) sous-traitant(s).
- [ ] **Pseudonymiser** avant transfert (mesure de réduction du risque).
- [ ] Documenter l'analyse de transfert (TIA).

## 5. Risques pour les personnes & mesures

| Risque | Gravité | Mesure |
|--------|---------|--------|
| Décision défavorable biaisée | Élevée | Scoring déterministe + test de biais + révision humaine |
| Perte de confidentialité du CV | Élevée | Bucket privé + URLs signées + RLS deny-all |
| Transfert hors UE non maîtrisé | Élevée | DPA + pseudonymisation + TIA |
| Absence de contrôle de la personne | Moyenne | Information + consentement + droit de refus + révision humaine |

## 6. Droits des personnes (cf. Art. 12-22 RGPD)

- Information (13/14) : voir [mention d'information](../phase-1-social-contractuel/01-information-personnes-concernees.md).
- Accès, rectification, effacement, opposition.
- **Décision automatisée (Art. 22)** : non — décision finale humaine + droit de
  révision ([process](../phase-1-social-contractuel/03-process-revision-humaine-contestation.md)).

## 7. Avis du DPO & validation

| Champ | Valeur |
|-------|--------|
| Avis du DPO (Sullyvan BIJON) | [À COMPLÉTER] |
| Consultation CNIL nécessaire ? | [À COMPLÉTER — si risque résiduel élevé non maîtrisé] |
| Date de validation | [À COMPLÉTER] |

## 8. Révision

La DPIA est revue à chaque changement significatif (modèle, grille, sous-traitant)
et au minimum **annuellement**.
