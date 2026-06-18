-- ============================================================
-- Cartographie géographique — localisation consultants & AO
-- À exécuter dans le SQL Editor du projet UTI (déjà appliqué en prod).
-- ============================================================
-- Additif et idempotent. Ville saisie côté consultant + coordonnées géocodées
-- (BAN) mises en cache. Pour les AO : mode de travail + coordonnées de la
-- localisation. Le backend dégrade proprement si ces colonnes manquent.

ALTER TABLE public.consultants  ADD COLUMN IF NOT EXISTS city      TEXT;
ALTER TABLE public.consultants  ADD COLUMN IF NOT EXISTS latitude  DOUBLE PRECISION;
ALTER TABLE public.consultants  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

ALTER TABLE public.appels_offres ADD COLUMN IF NOT EXISTS work_mode TEXT;  -- onsite | hybrid | remote
ALTER TABLE public.appels_offres ADD COLUMN IF NOT EXISTS latitude  DOUBLE PRECISION;
ALTER TABLE public.appels_offres ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
