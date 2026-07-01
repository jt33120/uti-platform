-- ============================================================================
-- Migration : cycle de vie « Validation CV » (demande Sullyvan)
--
-- On enrichit ao_consultant_state (déjà porteur de human_rank / contact_status)
-- avec le suivi de validation commerciale d'un CV sur un AO :
--   - validation          : 'retenu' | 'non_retenu' (décision GRP-IT)
--   - sent_to_client_at    : date d'envoi du CV au client (marqueur + traçabilité)
--   - commercial_exchange  : échange commercial en cours (Oui/Non)
--   - deal_status          : 'gagnee' | 'perdue' (affaire)
--
-- Les valeurs autorisées sont validées côté API ; on garde les colonnes souples
-- (pas de CHECK nommé) pour une migration 100 % idempotente et ré-exécutable.
-- ============================================================================

ALTER TABLE public.ao_consultant_state
  ADD COLUMN IF NOT EXISTS validation TEXT;                       -- 'retenu' | 'non_retenu'
ALTER TABLE public.ao_consultant_state
  ADD COLUMN IF NOT EXISTS sent_to_client_at TIMESTAMPTZ;         -- CV envoyé au client
ALTER TABLE public.ao_consultant_state
  ADD COLUMN IF NOT EXISTS commercial_exchange BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.ao_consultant_state
  ADD COLUMN IF NOT EXISTS deal_status TEXT;                      -- 'gagnee' | 'perdue'
