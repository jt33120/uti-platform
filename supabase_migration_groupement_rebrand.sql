-- ============================================================
-- Migration : rebranding Groupement-IT + gestion des comptes
--   * profiles.org    — entité du commercial (uti / groupement-it)
--   * profiles.status — actif / suspendu / désactivé (bloque le login)
--   * invitations.org — porte l'entité jusqu'à l'inscription
-- À exécuter dans le SQL Editor Supabase (idempotent).
-- ============================================================

-- 1. Entité commerciale (NULL = UTI par défaut, rétro-compatible)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS org TEXT;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_org_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_org_check CHECK (org IS NULL OR org IN ('uti', 'groupement-it'));

ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS org TEXT;
ALTER TABLE public.invitations DROP CONSTRAINT IF EXISTS invitations_org_check;
ALTER TABLE public.invitations
  ADD CONSTRAINT invitations_org_check CHECK (org IS NULL OR org IN ('uti', 'groupement-it'));

-- 2. Statut du compte — pilote l'accès (le login refuse tout sauf 'active')
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_status_check CHECK (status IN ('active', 'suspended', 'disabled'));
