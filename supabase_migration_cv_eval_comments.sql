-- ============================================================================
-- Migration : commentaires d'évaluation manuels par CV (demande Sullyvan)
--
-- Zones de texte libres, toujours éditables, rattachées à (AO × consultant)
-- pour aider à départager des profils à scores proches.
--   - eval_points_forts     : « Points forts du CV »
--   - eval_differenciants    : « Éléments différenciants »
-- ============================================================================

ALTER TABLE public.ao_consultant_state
  ADD COLUMN IF NOT EXISTS eval_points_forts TEXT;
ALTER TABLE public.ao_consultant_state
  ADD COLUMN IF NOT EXISTS eval_differenciants TEXT;
