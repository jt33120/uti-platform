# Fiche d'identification du système d'IA

> Statut : 🟧 EN COURS · Responsable : Produit · Dernière mise à jour : 2026-06-17
> Articles AI Act : Art. 6, Annexe III pt 4 — base de la documentation technique (Art. 11)

## 1. Identification

| Champ | Valeur |
|-------|--------|
| Nom du système | Moteur de matching de CV UTI Group |
| Version | [À COMPLÉTER : version applicative] |
| Fournisseur (provider) | UTI Group |
| Coordonnées | [À COMPLÉTER : adresse, SIREN, contact] |
| Personne de contact conformité | [À COMPLÉTER] |
| Marché | France |

## 2. Finalité

Évaluer et **classer des consultants / freelances externes** par rapport à un
appel d'offres (AO) client, afin d'**assister** la décision humaine de
présélection. Le système produit, par consultant :
- un **score total /100** ;
- un **breakdown** (compétences 40 / séniorité 20 / contexte 20 / TJM 20) ;
- des **points forts / points faibles** ;
- une **recommandation** (FORT / MOYEN / FAIBLE) et un **rang**.

## 3. Classification

- **Catégorie** : haut risque, **Annexe III, point 4(a)** — « recrutement ou
  sélection de personnes physiques, notamment pour évaluer des candidats »,
  incluant l'**accès au travail indépendant**.
- **Dérogation Art. 6(3)** : **non applicable** — le système réalise un
  **profilage** de personnes physiques (score individuel), ce qui exclut
  expressément la dérogation « risque non significatif ».
- **Décision** : **haut risque — actée** (UTI Group, juin 2026).

## 4. Description fonctionnelle (état actuel)

| Étape | Composant | Détail |
|-------|-----------|--------|
| Soumission | `routers/submissions.py` | Upload CV PDF + consentement RGPD bloquant |
| Extraction texte | `services/cv_parser.py` | Texte brut du PDF |
| Scoring | `services/ai_matching.py` | LLM **Claude 3.5 Haiku** via OpenRouter, JSON structuré, `temperature=0.2` |
| Orchestration | `services/matching_runner.py` | Score, tri, persistance top-N (table `matchings`) |
| Restitution | `routers/matching.py` | Résultats lus par le staff ; partenaires limités à leurs soumissions |

> **Écart cible (Phase 3)** : le scoring sera scindé en **extraction par LLM** +
> **scoring déterministe en code**. Voir
> [spec architecture hybride](../phase-3-technique/02-spec-architecture-hybride.md).

## 5. Données traitées

| Donnée | Nature | Source | Sensibilité |
|--------|--------|--------|-------------|
| CV (PDF + texte) | Données personnelles | Partenaire | Élevée (parcours, identité) |
| Nom, e-mail, téléphone consultant | Données personnelles | Partenaire | Élevée |
| Compétences, TJM, expérience | Données professionnelles | Partenaire | Moyenne |
| Score, breakdown, recommandation | Donnée dérivée (profilage) | Système | Élevée |

> Sous-traitant IA : **OpenRouter → Anthropic** (hors UE). À couvrir par la
> [DPIA](../rgpd/DPIA.md) (transfert, base légale, DPA).

## 6. Utilisateurs & personnes concernées

- **Utilisateurs (deployers internes)** : staff UTI (rôles `admin`, `commerce`).
- **Utilisateurs tiers** : partenaires (rôle `ao`) — accès restreint à leurs soumissions.
- **Personnes concernées** : **consultants / freelances externes** dont le CV est scoré.

## 7. Supervision humaine

La décision finale de présentation au client est **humaine**. Le système est un
outil d'**aide à la décision**, jamais une décision automatisée au sens de
l'Art. 22 RGPD. La matérialisation de l'override est en cours (Phase 3, Art. 14).

## 8. Historique des versions de cette fiche

| Date | Version | Auteur | Changement |
|------|---------|--------|------------|
| 2026-06-17 | 0.1 | [À COMPLÉTER] | Création |
