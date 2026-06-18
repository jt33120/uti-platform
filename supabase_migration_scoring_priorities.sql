-- ============================================================
-- Priorités de scoring « en étoiles » + surcharge par AO
-- À exécuter dans le SQL Editor du projet UTI.
-- ============================================================
-- Additif et idempotent : aucune donnée existante n'est modifiée.
-- Le backend dégrade proprement si ces colonnes n'existent pas encore
-- (les écritures retombent sur la forme historique), mais sans elles les
-- priorités par-AO et la forme « étoiles » ne sont pas persistées.

-- 1) Importance « en étoiles » (1-5) sur la config globale.
--    Les poids w_* (somme = 100) restent dérivés et stockés pour la
--    rétro-compatibilité et la lisibilité de l'audit.
ALTER TABLE public.scoring_config ADD COLUMN IF NOT EXISTS s_competences SMALLINT;
ALTER TABLE public.scoring_config ADD COLUMN IF NOT EXISTS s_seniorite   SMALLINT;
ALTER TABLE public.scoring_config ADD COLUMN IF NOT EXISTS s_contexte    SMALLINT;
ALTER TABLE public.scoring_config ADD COLUMN IF NOT EXISTS s_tjm         SMALLINT;

-- 2) Surcharge de grille propre à un AO (priorités de matching).
--    Forme : {"stars": {"competences":5,...}, "seniority_full_years": 8,
--             "reco_fort_min": 80, "reco_moyen_min": 50}. Toutes les clés sont
--    optionnelles : ce qui est absent retombe sur la config globale.
ALTER TABLE public.appels_offres ADD COLUMN IF NOT EXISTS scoring_overrides JSONB;
