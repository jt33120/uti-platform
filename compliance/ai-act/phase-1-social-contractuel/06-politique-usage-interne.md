# Politique d'usage interne & superviseurs habilités

> Statut : 🟥 À FAIRE · Responsable : Direction · Dernière mise à jour : 2026-06-17
> Articles : AI Act Art. 26 (usage conforme), Art. 4 (compétence des opérateurs)

## 1. Objet

Encadrer l'utilisation du système de matching par les opérateurs internes
(deployer) conformément à la notice et au principe de supervision humaine.

## 2. Règles d'usage

1. **Le score est une aide, jamais une décision.** Aucun consultant n'est retenu
   ou écarté sur le seul fondement du score IA.
2. **Lecture critique obligatoire** : l'opérateur examine le CV et le breakdown,
   pas uniquement le rang.
3. **Override documenté** : tout écart par rapport à la recommandation IA est
   justifié et tracé (voir
   [supervision Art. 14](../phase-3-technique/04-spec-supervision-humaine.md)).
4. **Données d'entrée maîtrisées** : ne traiter que des CV soumis avec
   consentement valide ; signaler toute donnée douteuse.
5. **Suspension** : en cas de comportement anormal du système (scores incohérents,
   biais visible), suspendre l'usage et alerter le responsable conformité.
6. **Confidentialité** : les CV et scores sont confidentiels (bucket privé + URLs
   signées déjà en place).

## 3. Superviseurs habilités

Seules des personnes **formées et désignées** valident les sorties du système.

| Opérateur | Rôle applicatif | Formation suivie | Habilité depuis |
|-----------|-----------------|------------------|-----------------|
| [À COMPLÉTER] | commerce/admin | M1+M3 (littératie) | [À COMPLÉTER] |

## 4. Conditions d'habilitation

- Avoir suivi les modules M1 (cadre) et M3 (supervision/override) du
  [plan de littératie](../phase-0-gouvernance/03-plan-litteratie-ia.md).
- Connaître la [notice d'utilisation](../phase-3-technique/01-notice-utilisation.md).
- Connaître le [process de contestation](03-process-revision-humaine-contestation.md).

## 5. Contrôle

- [ ] Revue trimestrielle des overrides et de leur justification.
- [ ] Revue annuelle de la liste des opérateurs habilités.
