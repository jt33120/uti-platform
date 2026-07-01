-- Migration : historique d'intervention du candidat chez le client de l'AO
-- (demande Sullyvan, ex. CMA CGM). Renseigné à la soumission d'un CV.
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS worked_at_client BOOLEAN;
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS worked_at_client_exit_date DATE;
