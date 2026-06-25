-- ============================================================
-- Migration : référence client / de la consultation sur l'AO
--   appels_offres.reference — ex. "Marché Spécifique n°23915SA230MS"
--   Sert à l'affichage et à la recherche d'un AO par sa référence.
-- À exécuter dans le SQL Editor Supabase (idempotent).
-- ============================================================

ALTER TABLE public.appels_offres ADD COLUMN IF NOT EXISTS reference TEXT;
