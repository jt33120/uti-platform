-- Classement humain + statut de contact, par (AO, consultant).
-- Table SÉPARÉE des `matchings` car celles-ci sont supprimées/réinsérées à chaque
-- re-scoring : le mot final de l'humain et le suivi de diffusion doivent survivre.
--   * human_rank     : ordre choisi par l'opérateur (prime sur le score IA à l'affichage)
--   * contact_status : 'none' | 'contacted' | 'proposed' (suivi de diffusion)
--   * decided_by     : qui a posé l'override (audit AI Act Art. 14)
CREATE TABLE IF NOT EXISTS public.ao_consultant_state (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ao_id          uuid NOT NULL REFERENCES public.appels_offres(id) ON DELETE CASCADE,
  consultant_id  uuid NOT NULL REFERENCES public.consultants(id) ON DELETE CASCADE,
  human_rank     integer,
  contact_status text NOT NULL DEFAULT 'none',
  contacted_at   timestamptz,
  decided_by     uuid,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ao_id, consultant_id)
);

CREATE INDEX IF NOT EXISTS idx_ao_consultant_state_ao
  ON public.ao_consultant_state (ao_id);
