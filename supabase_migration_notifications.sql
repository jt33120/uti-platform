-- ============================================================
-- Migration : moteur de notifications partenaires + relances
--   * appels_offres : suivi des envois (liste 1 / liste 2 / relances)
--   * app_settings  : réglages globaux pilotés par l'admin (clé/valeur)
-- À exécuter dans le SQL Editor Supabase (idempotent).
-- ============================================================

-- Suivi des notifications sur l'AO
ALTER TABLE public.appels_offres ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;          -- liste 1 envoyée (campagne lancée)
ALTER TABLE public.appels_offres ADD COLUMN IF NOT EXISTS list2_scheduled_at TIMESTAMPTZ;   -- échéance d'envoi liste 2
ALTER TABLE public.appels_offres ADD COLUMN IF NOT EXISTS list2_notified_at TIMESTAMPTZ;    -- liste 2 envoyée
ALTER TABLE public.appels_offres ADD COLUMN IF NOT EXISTS last_relance_at TIMESTAMPTZ;      -- dernière relance (auto ou manuelle)
ALTER TABLE public.appels_offres ADD COLUMN IF NOT EXISTS relance_count INTEGER NOT NULL DEFAULT 0;

-- Réglages applicatifs globaux (clé → valeur JSON), édités par l'admin
CREATE TABLE IF NOT EXISTS public.app_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
