# Registre de conformité AI Act — Suivi des actions

> Statut : 🟧 EN COURS · Responsable : [À COMPLÉTER : responsable conformité IA] · Dernière mise à jour : 2026-06-17

Légende statut : 🟥 À FAIRE · 🟧 EN COURS · 🟩 VALIDÉ · ⬜ Sans objet

| # | Action | Phase | Articles | Type | Statut | Responsable | Document |
|---|--------|-------|----------|------|--------|-------------|----------|
| 1 | Désigner un responsable conformité IA | 0 | Gouvernance | Non-code | 🟥 | Direction | [roles](phase-0-gouvernance/01-roles-et-responsabilites.md) |
| 2 | Acter les casquettes provider/deployer/distributeur | 0 | — | Non-code | 🟩 | Direction | [roles](phase-0-gouvernance/01-roles-et-responsabilites.md) |
| 3 | Fiche d'identification du système | 0 | Art. 6, Annexe III | Non-code | 🟧 | Produit | [fiche-systeme](phase-0-gouvernance/02-fiche-systeme.md) |
| 4 | Plan de littératie IA | 0 | Art. 4 | Non-code | 🟥 | RH/Direction | [litteratie](phase-0-gouvernance/03-plan-litteratie-ia.md) |
| 5 | Lancer la DPIA RGPD | 0 | RGPD Art. 35 | Non-code | 🟧 | DPO | [DPIA](rgpd/DPIA.md) |
| 6 | Information des personnes concernées (consultants) | 1 | RGPD 13/14, transparence | Non-code | 🟧 | DPO/Juridique | [information](phase-1-social-contractuel/01-information-personnes-concernees.md) |
| 7 | Mécanisme consentement + droit de refus + voie manuelle | 1 | RGPD 6/7 | Mixte | 🟥 | Produit/DPO | [consentement](phase-1-social-contractuel/02-consentement-et-droit-de-refus.md) |
| 8 | Process de révision humaine / contestation | 1 | Art. 14, RGPD 22 | Mixte | 🟥 | Produit/Juridique | [revision](phase-1-social-contractuel/03-process-revision-humaine-contestation.md) |
| 9 | Clause flow-down partenaires | 1 | Art. 26, RGPD | Non-code | 🟥 | Juridique | [flow-down](phase-1-social-contractuel/04-clause-flow-down-partenaires.md) |
| 10 | Information interne de l'équipe (pas de CSE < 11) | 1 | Art. 26(7) | Non-code | 🟥 | Direction | [info-interne](phase-1-social-contractuel/05-information-interne-equipe.md) |
| 11 | Politique d'usage interne + superviseurs habilités | 1 | Art. 26, Art. 4 | Non-code | 🟥 | Direction | [usage-interne](phase-1-social-contractuel/06-politique-usage-interne.md) |
| 12 | Système de gestion des risques | 2 | Art. 9 | Non-code | 🟥 | Conformité | [risques](phase-2-risques-donnees/01-systeme-gestion-risques.md) |
| 13 | Gouvernance des données | 2 | Art. 10 | Mixte | 🟥 | Produit/Data | [donnees](phase-2-risques-donnees/02-gouvernance-donnees.md) |
| 14 | Campagne de test de biais | 2 | Art. 10, 15 | Code | 🟥 | Data | [biais](phase-2-risques-donnees/03-plan-test-biais.md) |
| 15 | Architecture hybride (extraction LLM / scoring déterministe) | 3 | Art. 13, 15 | Code | 🟧 | Dev | [archi](phase-3-technique/02-spec-architecture-hybride.md) — _code livré ; seuils métier à valider_ |
| 16 | Pseudonymisation de l'entrée LLM | 3 | Art. 10, RGPD | Code | 🟩 | Dev | `services/pseudonymize.py` |
| 17 | Journalisation automatique | 3 | Art. 12 | Code | 🟧 | Dev | [journalisation](phase-3-technique/03-spec-journalisation.md) — _code livré ; migration `audit_log` à appliquer_ |
| 18 | Supervision humaine effective (override + justification) | 3 | Art. 14 | Code | 🟧 | Dev | [supervision](phase-3-technique/04-spec-supervision-humaine.md) — _endpoint livré ; migration `human_decision` à appliquer_ |
| 19 | Exactitude / robustesse / cybersécurité | 3 | Art. 15 | Mixte | 🟧 | Dev | [robustesse](phase-3-technique/05-exactitude-robustesse-cyber.md) |
| 20 | Notice d'utilisation | 3 | Art. 13 | Non-code | 🟥 | Produit | [notice](phase-3-technique/01-notice-utilisation.md) |
| 21 | Dossier technique Annexe IV | 4 | Art. 11, Annexe IV | Non-code | 🟥 | Conformité | [annexe-IV](phase-4-documentation-qms/01-dossier-technique-annexe-IV.md) |
| 22 | Système de management de la qualité (QMS) | 4 | Art. 17 | Non-code | 🟥 | Conformité | [qms](phase-4-documentation-qms/02-systeme-management-qualite.md) |
| 23 | Politique de conservation (doc 10 ans, logs ≥ 6 mois) | 4 | Art. 18-19 | Mixte | 🟥 | Conformité/Dev | [conservation](phase-4-documentation-qms/03-politique-conservation.md) |
| 24 | Auto-évaluation contrôle interne (Annexe VI) | 5 | Art. 43, Annexe VI | Non-code | 🟥 | Conformité | _Phase 5 (à venir)_ |
| 25 | Déclaration UE de conformité (signée) | 5 | Art. 47 | Non-code | 🟥 | Direction | _Phase 5 (à venir)_ |
| 26 | Marquage CE | 5 | Art. 48 | Non-code | 🟥 | Conformité | _Phase 5 (à venir)_ |
| 27 | Enregistrement base de données UE | 5 | Art. 49 | Non-code | 🟥 | Conformité | _Phase 5 (à venir)_ |
| 28 | Plan de surveillance post-commercialisation | 6 | Art. 72 | Mixte | 🟥 | Conformité | _Phase 6 (à venir)_ |
| 29 | Procédure de signalement d'incidents graves | 6 | Art. 73, 20 | Non-code | 🟥 | Conformité | _Phase 6 (à venir)_ |

## Périmètre de ce dossier

Ce dépôt couvre les **Phases 0 à 4** (actions 1 à 23). Les Phases 5 (conformité
formelle : Annexe VI, DoC, CE, base UE) et 6 (post-marché) seront ajoutées une
fois les Phases 0–4 stabilisées et le dossier technique Annexe IV complet.

## Prochaines décisions bloquantes (à trancher par UTI)

1. **Nommer le responsable conformité IA** (action 1) — rien n'avance sans.
2. **Valider la classification haut risque par un conseil juridique** (sécurise tout le dossier).
3. **Décider la voie d'évaluation manuelle de secours** pour les consultants refusant l'IA (action 7) — impact produit.
