# Politique de conservation (Art. 18-19) & RGPD

> Statut : 🟥 À FAIRE · Responsable : Conformité / Dev · Dernière mise à jour : 2026-06-17
> Articles AI Act : Art. 18 (doc 10 ans), Art. 19 (logs) ; RGPD Art. 5 (limitation)

## 1. Durées de conservation

| Donnée / document | Durée | Base | Responsable |
|-------------------|-------|------|-------------|
| Documentation technique (Annexe IV) | **10 ans** après mise sur le marché | Art. 18 | Conformité |
| Déclaration UE de conformité | **10 ans** | Art. 18 | Conformité |
| Logs générés automatiquement (`audit_log`) | **≥ 6 mois** (deployer, Art. 26) — cible UTI : [À COMPLÉTER, ex. 12 mois] | Art. 19/26 | Dev |
| Décisions humaines (`human_decision`) | [À COMPLÉTER — aligné sur la durée des logs] | Art. 14 | Dev |
| CV et données personnelles des consultants | [À COMPLÉTER — RGPD, minimisation] | RGPD | DPO |
| Preuves de consentement | Durée du traitement + prescription | RGPD Art. 7 | DPO |
| Registre des contestations | [À COMPLÉTER] | Art. 14 | DPO |

> ⚠️ **Tension à arbitrer** : la conservation longue des logs (auditabilité IA)
> doit se concilier avec la **minimisation RGPD**. D'où l'importance de la
> **pseudonymisation** : les logs ne contiennent pas le CV en clair, donc leur
> conservation prolongée est moins risquée.

## 2. Cohérence avec l'existant

- **Droit à l'effacement** déjà servi par `DELETE /users/{user_id}/gdpr` (supprime
  aussi les fichiers CV du stockage) — voir `supabase_schema.sql`.
- **Purge des consultants inactifs** (> 2 ans, sans submission) déjà documentée.

## 3. Mise en œuvre technique

- [ ] Tâche d'archivage/purge des logs au-delà de la durée retenue.
- [ ] Vérifier que la purge RGPD couvre `audit_log` / `human_decision` (références,
      pas de PII en clair → conservation possible des entrées techniques).
- [ ] Documenter les durées dans la [notice](../phase-3-technique/01-notice-utilisation.md)
      et la [mention d'information](../phase-1-social-contractuel/01-information-personnes-concernees.md).

## 4. À décider par UTI

- [ ] Durée exacte de conservation des logs (≥ 6 mois ; recommandé 12 mois).
- [ ] Durée de conservation des CV consultants (minimisation RGPD).
