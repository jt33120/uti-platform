-- ============================================================
-- Paramètres de scoring pilotables par l'admin (grille + seuils)
-- À exécuter dans le SQL Editor du projet UTI.
-- ============================================================
-- Singleton (une seule ligne attendue). Le backend lit/écrit via service_role.
-- RLS deny-all : accès direct refusé.

CREATE TABLE IF NOT EXISTS public.scoring_config (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  w_competences        INT NOT NULL DEFAULT 40,
  w_seniorite          INT NOT NULL DEFAULT 20,
  w_contexte           INT NOT NULL DEFAULT 20,
  w_tjm                INT NOT NULL DEFAULT 20,
  seniority_full_years INT NOT NULL DEFAULT 8,
  reco_fort_min        INT NOT NULL DEFAULT 75,
  reco_moyen_min       INT NOT NULL DEFAULT 50,
  updated_by           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Garde-fous cohérence (doublent la validation backend)
  CONSTRAINT scoring_weights_sum CHECK (w_competences + w_seniorite + w_contexte + w_tjm = 100),
  CONSTRAINT scoring_reco_order  CHECK (reco_fort_min > reco_moyen_min)
);

ALTER TABLE public.scoring_config ENABLE ROW LEVEL SECURITY;
