# Dossier technique — Annexe IV (Art. 11)

> Statut : 🟥 À FAIRE · Responsable : Conformité · Dernière mise à jour : 2026-06-17
> Articles AI Act : Art. 11, Annexe IV — **à conserver 10 ans** (Art. 18)

Ce document est le **dossier maître** exigé par l'Annexe IV. Il agrège (ou
référence) tous les livrables du dossier de conformité. Il doit être **tenu à
jour** à chaque évolution du système.

## Section 1 — Description générale du système
- Finalité, version, fournisseur : voir [fiche système](../phase-0-gouvernance/02-fiche-systeme.md).
- Comment le système interagit avec matériels/logiciels : plateforme web
  (FastAPI + React + Supabase + Vercel/OVH), LLM via OpenRouter.
- Formes de mise à disposition : SaaS interne + partenaires.
- [À COMPLÉTER : captures d'écran / schémas d'architecture]

## Section 2 — Conception et développement
- Architecture cible : [architecture hybride](../phase-3-technique/02-spec-architecture-hybride.md).
- Logique algorithmique, grille de scoring et poids : voir
  [gouvernance des données](../phase-2-risques-donnees/02-gouvernance-donnees.md).
- Choix de conception et arbitrages (LLM extraction / scoring déterministe).
- Modèle pré-entraîné tiers : Anthropic Claude 3.5 Haiku (via OpenRouter).

## Section 3 — Données
- Données d'entrée, qualité, pertinence, biais : voir
  [gouvernance des données](../phase-2-risques-donnees/02-gouvernance-donnees.md).
- Jeu de test de biais : voir [plan de test de biais](../phase-2-risques-donnees/03-plan-test-biais.md).

## Section 4 — Surveillance, fonctionnement, contrôle
- Supervision humaine : voir [spec supervision](../phase-3-technique/04-spec-supervision-humaine.md).
- Limites et précision attendues : voir [notice](../phase-3-technique/01-notice-utilisation.md).

## Section 5 — Performances
- Niveau d'exactitude/robustesse : voir
  [exactitude/robustesse/cyber](../phase-3-technique/05-exactitude-robustesse-cyber.md).
- [À COMPLÉTER : métriques mesurées]

## Section 6 — Gestion des risques
- Voir [système de gestion des risques](../phase-2-risques-donnees/01-systeme-gestion-risques.md).

## Section 7 — Modifications du cycle de vie
- [À COMPLÉTER : journal des versions du système et des changements significatifs]

## Section 8 — Normes appliquées
- [À COMPLÉTER : normes harmonisées appliquées une fois publiées]

## Section 9 — Déclaration UE de conformité
- _À produire en Phase 5._

## Section 10 — Journalisation
- Voir [spec journalisation](../phase-3-technique/03-spec-journalisation.md).

## Section 11 — Système de management de la qualité
- Voir [QMS](02-systeme-management-qualite.md).

## Section 12 — Cybersécurité
- Voir [exactitude/robustesse/cyber](../phase-3-technique/05-exactitude-robustesse-cyber.md)
  (RLS deny-all, URLs signées, secrets, en-têtes).

---

### Tenue à jour

| Date | Version dossier | Auteur | Changement |
|------|-----------------|--------|------------|
| 2026-06-17 | 0.1 | [À COMPLÉTER] | Création de la structure |
