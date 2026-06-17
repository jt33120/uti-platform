-- ============================================================
-- AI Act Art. 14 — Décisions humaines (supervision / override)
-- À exécuter dans le SQL Editor du projet UTI.
-- ============================================================
-- Matérialise la supervision humaine : un opérateur habilité retient/écarte un
-- profil indépendamment du rang IA, avec justification obligatoire en cas
-- d'override. RLS deny-all (accès via backend service_role uniquement).

CREATE TABLE IF NOT EXISTS public.human_decision (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ao_id         UUID NOT NULL REFERENCES public.appels_offres(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES public.submissions(id) ON DELETE SET NULL,
  consultant_id UUID REFERENCES public.consultants(id) ON DELETE SET NULL,
  ai_rank       INT,                           -- rang proposé par le système
  ai_score      INT,                           -- score proposé par le système
  decision      TEXT NOT NULL CHECK (decision IN ('retained', 'rejected', 'overridden')),
  justification TEXT,                           -- obligatoire si decision = 'overridden' (vérifié côté backend)
  decided_by    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_human_decision_ao_id      ON public.human_decision(ao_id);
CREATE INDEX IF NOT EXISTS idx_human_decision_decided_by ON public.human_decision(decided_by);

-- RLS deny-all : RLS activée + zéro policy => accès direct refusé. Le backend
-- (service_role) contourne la RLS et applique l'autorisation (require_staff).
ALTER TABLE public.human_decision ENABLE ROW LEVEL SECURITY;
