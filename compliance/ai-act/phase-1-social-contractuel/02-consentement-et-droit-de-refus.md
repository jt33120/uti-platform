# Consentement & droit de refus de l'évaluation par IA

> Statut : 🟥 À FAIRE · Responsable : Produit / DPO · Dernière mise à jour : 2026-06-17
> Articles : RGPD 6/7, AI Act Art. 14 (supervision)

## 1. État actuel (code)

Un **consentement RGPD bloquant** existe déjà à la soumission
(`backend/routers/submissions.py`, paramètre `consent` ; refus ⇒ HTTP 422). C'est
une bonne base, mais il faut **distinguer deux consentements** et ajouter une
**voie de secours sans IA**.

## 2. Les deux consentements à distinguer

| Consentement | Objet | Conséquence si refus |
|--------------|-------|----------------------|
| **C1 — Traitement du CV** | Upload, parsing, stockage | Pas de soumission possible |
| **C2 — Évaluation par IA** | Scoring/classement par le système haut risque | **Voie d'évaluation manuelle de secours** (pas d'exclusion automatique) |

> ⚠️ **Point produit bloquant** : aujourd'hui, refuser = ne pas être soumis. Pour
> être conforme **et** équitable, un consultant qui refuse l'IA (C2) doit pouvoir
> être évalué **manuellement**. À défaut, le refus revient à une exclusion, ce qui
> fragilise la base légale et expose à un risque discrimination.

## 3. Voie d'évaluation manuelle de secours (à décider)

Options à arbitrer par UTI :

1. **Évaluation 100 % manuelle** par le staff commerce (lecture du CV, pas de score IA).
2. **Score neutre + revue humaine systématique** (le profil reste visible, sans rang IA).
3. **Exclusion assumée et documentée** — ⚠️ déconseillé (risque juridique).

**Décision UTI** : [À COMPLÉTER]

## 4. Implémentation cible

- [ ] Ajouter un champ `ai_scoring_consent` (booléen) distinct du consentement CV.
- [ ] Si refus : marquer la soumission `manual_review_required` et l'**exclure du
      prompt LLM** (jamais envoyée au modèle).
- [ ] Tracer la date/version de la mention d'information acceptée.

## 5. Preuve de consentement (RGPD Art. 7)

Conserver, par soumission : horodatage, version de la mention acceptée, canal
(UTI direct ou via partenaire), et le périmètre (C1 / C2). Voir
[politique de conservation](../phase-4-documentation-qms/03-politique-conservation.md).
