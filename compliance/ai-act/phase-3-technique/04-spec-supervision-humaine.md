# Spécification — Supervision humaine effective (Art. 14)

> Statut : 🟥 À FAIRE · Responsable : Dev · Dernière mise à jour : 2026-06-17
> Articles AI Act : Art. 14, RGPD Art. 22

## 1. Objectif

Garantir que l'humain peut **comprendre, contrôler, intervenir et passer outre**
le système — réellement, pas via un bouton cosmétique.

## 2. État actuel

L'humain **voit** le classement (`routers/matching.py`) mais rien ne capture une
**décision humaine** divergente ni sa justification. La supervision n'est pas
matérialisée.

## 3. Capacités à offrir (Art. 14)

| Capacité | Implémentation |
|----------|----------------|
| Comprendre la sortie | Afficher breakdown + points forts/faibles + version de la grille |
| Surveiller | Indicateurs de cohérence (ex. alerte si scores aberrants) |
| Intervenir | Action « retenir / écarter » indépendante du rang IA |
| Passer outre (override) | Décision + **justification obligatoire** tracée |
| Arrêter | Possibilité de suspendre l'usage (politique d'usage) |

## 4. Schéma proposé (table `human_decision`)

```sql
CREATE TABLE public.human_decision (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ao_id         UUID NOT NULL,
  submission_id UUID,
  consultant_id UUID,
  ai_rank       INT,            -- rang proposé par le système
  ai_score      INT,            -- score proposé
  decision      TEXT NOT NULL,  -- retained | rejected | overridden
  justification TEXT,           -- obligatoire si override
  decided_by    UUID NOT NULL,  -- profiles.id (opérateur habilité)
  decided_at    TIMESTAMPTZ DEFAULT NOW()
);
```

## 5. Règles

- **Justification obligatoire** dès que `decision = overridden` (l'opérateur
  s'écarte de la recommandation). Refus applicatif si vide.
- **Opérateur habilité** uniquement (voir
  [politique d'usage](../phase-1-social-contractuel/06-politique-usage-interne.md)).
- **Traçabilité** : chaque décision génère un événement
  [`audit_log`](03-spec-journalisation.md) (`event_type = override`).

## 6. Lien avec la contestation

En cas de contestation d'un consultant, le réviseur s'appuie sur `human_decision`
+ `audit_log` pour reconstituer le raisonnement. Voir
[process de contestation](../phase-1-social-contractuel/03-process-revision-humaine-contestation.md).

## 7. À implémenter

- [ ] Migration SQL `human_decision`
- [ ] Endpoint backend (création/lecture des décisions)
- [ ] UI : action retenir/écarter + champ justification
- [ ] Revue trimestrielle des overrides (qualité de la supervision)
