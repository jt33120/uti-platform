-- Score hybride (déterministe + second avis IA) sur les résultats de matching.
-- Le score_total reste le score déterministe (ancre auditable, AI Act) ; on ajoute
-- l'avis IA, le score combiné, l'indice d'accord et les justifications.
ALTER TABLE public.matchings
  ADD COLUMN IF NOT EXISTS score_llm        integer,
  ADD COLUMN IF NOT EXISTS score_hybride    integer,
  ADD COLUMN IF NOT EXISTS agreement        integer,
  ADD COLUMN IF NOT EXISTS llm_breakdown    jsonb,
  ADD COLUMN IF NOT EXISTS llm_global       text,
  ADD COLUMN IF NOT EXISTS hybrid_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS weights          jsonb;  -- barèmes effectifs par axe (radar)
