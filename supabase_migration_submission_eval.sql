-- Migration : « Points forts » et « Éléments différenciants » renseignés par le
-- partenaire À LA SOUMISSION du CV (demande Sullyvan — déplacés depuis la
-- validation vers « Proposer un consultant »).
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS points_forts TEXT;
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS elements_differenciants TEXT;
