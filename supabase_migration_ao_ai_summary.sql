-- ============================================================
-- Résumé IA d'un AO (accroche en 1 phrase sur la fiche)
-- À exécuter dans le SQL Editor du projet UTI.
-- ============================================================
-- Additif et idempotent. Généré par un petit modèle au moment de la création
-- (tâche de fond) et régénérable via POST /aos/{id}/summary. Le backend dégrade
-- proprement si la colonne n'existe pas encore.

ALTER TABLE public.appels_offres ADD COLUMN IF NOT EXISTS ai_summary TEXT;
