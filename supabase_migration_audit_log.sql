-- ============================================================
-- AI Act Art. 12 — Journal d'audit du pipeline de matching
-- À exécuter dans le SQL Editor du projet UTI.
-- ============================================================
-- Append-only. Aucune donnée personnelle en clair : on stocke un hash des
-- features et des métadonnées techniques. RLS deny-all (accès via backend
-- service_role uniquement), cohérent avec le reste de la base.

CREATE TABLE IF NOT EXISTS public.audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id        UUID NOT NULL,                 -- corrèle un même scoring
  ao_id         UUID,
  event_type    TEXT NOT NULL,                 -- run_start | score | override | error
  actor_id      UUID,                          -- profiles.id (opérateur), si applicable
  model_version TEXT,                          -- ex. anthropic/claude-3.5-haiku
  grid_version  TEXT,                          -- version de la grille de scoring
  input_hash    TEXT,                          -- hash des features (pas de PII)
  payload       JSONB,                         -- détail technique (pas de CV en clair)
  severity      TEXT NOT NULL DEFAULT 'info',  -- info | warning | error
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_run_id     ON public.audit_log(run_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_ao_id      ON public.audit_log(ao_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at DESC);

-- RLS deny-all : RLS activée + zéro policy => accès direct (anon/authenticated)
-- intégralement refusé. Le backend (service_role) contourne la RLS.
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Append-only : ne pas créer de policy ; ne pas exposer UPDATE/DELETE côté app.
-- La conservation (≥ 6 mois) est gérée par la politique de conservation
-- (compliance/ai-act/phase-4-documentation-qms/03-politique-conservation.md).
