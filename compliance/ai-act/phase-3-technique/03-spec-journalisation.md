# Spécification — Journalisation automatique (Art. 12)

> Statut : 🟥 À FAIRE · Responsable : Dev · Dernière mise à jour : 2026-06-17
> Articles AI Act : Art. 12 (journalisation), Art. 19 (conservation des logs)

## 1. Objectif

Rendre chaque scoring **traçable et auditable** : qui, quand, avec quelle entrée,
quel modèle, quelle sortie, et quels incidents. C'est ce qui rend le système
défendable devant la surveillance de marché et permet de traiter une contestation.

## 2. État actuel (insuffisant)

La table `matchings` conserve le **résultat** (`score_total`, `breakdown`,
`ran_by`, `created_at`, `cost_usd`) mais **pas** : l'instantané d'entrée, la
version exacte du modèle/prompt, ni les erreurs (simples `print`).

## 3. Événements à journaliser

| Événement | Champs |
|-----------|--------|
| Lancement d'un scoring | id_run, ao_id, opérateur, horodatage, déclencheur (manuel/auto) |
| Entrée du modèle | hash des features pseudonymisées, version de la grille |
| Appel LLM (extraction) | modèle + version, paramètres (temp), tokens, coût |
| Sortie | scores, breakdown, recommandation, rang |
| Override humain | décision, justification, opérateur, horodatage |
| Erreur / incident | type, message, gravité |

## 4. Schéma proposé (table `audit_log`)

```sql
CREATE TABLE public.audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id        UUID NOT NULL,
  ao_id         UUID,
  event_type    TEXT NOT NULL,   -- run_start | extract | score | override | error
  actor_id      UUID,            -- profiles.id
  model_version TEXT,            -- ex. anthropic/claude-3.5-haiku@<date>
  grid_version  TEXT,            -- version de la grille de scoring
  input_hash    TEXT,            -- hash des features (pas le CV en clair)
  payload       JSONB,           -- détail (sans données perso sensibles en clair)
  severity      TEXT,            -- info | warning | error
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

> RLS : deny-all (accès uniquement via backend service_role), cohérent avec le
> reste de la base. Ne **jamais** stocker le CV en clair dans `payload` : un hash
> ou une référence suffit.

## 5. Règles

- **Inviolabilité** : pas de mise à jour/suppression applicative des lignes (append-only).
- **Pas de données sensibles en clair** : pseudonymisation respectée dans les logs.
- **Corrélation** : `run_id` relie toutes les lignes d'un même scoring.

## 6. Remplacement des `print`

Tous les `print("[MATCHING] ...")` de `matching_runner.py` sont remplacés par des
écritures `audit_log` + un logger applicatif structuré.

## 7. Conservation

Voir [politique de conservation](../phase-4-documentation-qms/03-politique-conservation.md) :
logs **≥ 6 mois** (deployer, Art. 26) ; la documentation technique **10 ans**.

## 8. À implémenter

- [ ] Migration SQL `audit_log`
- [ ] Helper `log_event(...)` côté backend
- [ ] Instrumentation du pipeline de matching
- [ ] Purge/archivage automatique selon la politique de conservation
