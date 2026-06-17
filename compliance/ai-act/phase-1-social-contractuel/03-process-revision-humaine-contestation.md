# Process de révision humaine & contestation

> Statut : 🟥 À FAIRE · Responsable : Produit / Juridique · Dernière mise à jour : 2026-06-17
> Articles : AI Act Art. 14 (supervision humaine), RGPD Art. 22 (décision automatisée)

## 1. Principe

Aucune décision produisant des effets juridiques ou significatifs ne doit reposer
**uniquement** sur le score IA. Tout consultant peut demander une **révision
humaine** de l'évaluation le concernant.

## 2. Garanties à offrir

| Garantie | Description |
|----------|-------------|
| Intervention humaine | Un membre du staff réexamine le dossier sans se limiter au score |
| Expression du point de vue | Le consultant peut apporter des éléments complémentaires |
| Contestation | Le consultant peut contester l'évaluation et demander un nouvel examen |
| Explication | Une explication compréhensible de la logique de scoring est fournie |

## 3. Circuit de traitement

1. **Réception** de la demande (canal : [À COMPLÉTER : e-mail / formulaire DPO]).
2. **Accusé de réception** sous [À COMPLÉTER : délai, ex. 72 h].
3. **Réexamen humain** par un opérateur **distinct** de celui ayant validé le scoring initial.
4. **Décision motivée** communiquée sous [À COMPLÉTER : délai, ex. 1 mois RGPD].
5. **Traçabilité** : la demande, le réexamen et la décision sont journalisés.

## 4. Lien avec le code (Phase 3)

La matérialisation technique de l'override humain (champ décision + justification)
est spécifiée dans
[supervision humaine Art. 14](../phase-3-technique/04-spec-supervision-humaine.md).
Le réexamen doit pouvoir s'appuyer sur le **journal d'audit**
([Art. 12](../phase-3-technique/03-spec-journalisation.md)) pour retrouver les
entrées exactes du scoring contesté.

## 5. Responsables

| Rôle | Personne |
|------|----------|
| Point de contact contestation | [À COMPLÉTER] |
| Réviseur humain habilité | Staff commerce désigné — voir [politique d'usage](06-politique-usage-interne.md) |
| Supervision DPO | Sullyvan BIJON |

## 6. À produire

- [ ] Modèle de réponse à une demande de révision
- [ ] Registre des contestations (date, motif, issue)
- [ ] Délais cibles validés par le juridique
