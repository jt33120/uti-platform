# Notice d'utilisation (Art. 13)

> Statut : 🟥 À FAIRE · Responsable : Produit · Dernière mise à jour : 2026-06-17
> Article AI Act : Art. 13 — instructions d'utilisation destinées aux déployeurs

Cette notice est destinée aux **déployeurs** : staff UTI et partenaires utilisant
le système. Elle accompagne le produit (Art. 13).

## 1. Identité du système

| Champ | Valeur |
|-------|--------|
| Système | Moteur de matching de CV UTI Group |
| Fournisseur | UTI Group — [À COMPLÉTER : coordonnées] |
| Version | [À COMPLÉTER] |
| Classification | Haut risque — Annexe III pt 4 |

## 2. Finalité et usage prévu

Assister la **présélection** de consultants pour des appels d'offres, en
produisant un score d'adéquation et un classement. **Usage prévu** : aide à la
décision par un opérateur humain habilité.

## 3. Capacités

- Évaluation d'un CV par rapport à un AO sur 4 critères (compétences, séniorité,
  contexte, TJM).
- Restitution d'un score /100, d'un breakdown, de points forts/faibles, d'une
  recommandation et d'un rang.

## 4. Limites (à lire avant tout usage)

- Le système **n'évalue pas** la personnalité, le « savoir-être » ni les émotions
  (interdit — Art. 5).
- Le score est **une estimation**, pas une vérité ; il peut comporter des erreurs.
- La qualité dépend de **l'exactitude des données d'entrée** (CV à jour).
- Le système **ne décide pas** : la décision appartient à l'opérateur humain.

## 5. Niveau de précision et reproductibilité

| Indicateur | Valeur |
|------------|--------|
| Modèle | [À COMPLÉTER : modèle + version figée] |
| Reproductibilité | Déterministe après architecture hybride (`temperature=0`) |
| Précision mesurée | [À COMPLÉTER : résultats des tests Art. 15] |

## 6. Supervision humaine attendue

- Lire le CV et le breakdown, pas seulement le rang.
- Justifier tout écart à la recommandation (override tracé).
- Orienter vers la [voie de contestation](../phase-1-social-contractuel/03-process-revision-humaine-contestation.md) si un consultant le demande.

## 7. Obligations du déployeur

- Vérifier le consentement et informer les personnes concernées.
- Conserver les logs ≥ 6 mois.
- Signaler tout dysfonctionnement au fournisseur (UTI).

## 8. Contact & support

- Support technique : [À COMPLÉTER]
- Référent conformité : [À COMPLÉTER]
- DPO : Sullyvan BIJON — [À COMPLÉTER : e-mail]
