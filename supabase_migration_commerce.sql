-- ============================================================
-- Migration : rôle « commerce » + supervision admin
-- À exécuter dans le SQL Editor Supabase (idempotent).
-- ============================================================

-- 1. Autoriser le rôle 'commerce' sur les profils
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'commerce', 'ao'));

-- 2. Autoriser le rôle 'commerce' sur les invitations
ALTER TABLE public.invitations DROP CONSTRAINT IF EXISTS invitations_role_check;
ALTER TABLE public.invitations
  ADD CONSTRAINT invitations_role_check CHECK (role IN ('admin', 'commerce', 'ao'));

-- 3. Dernière connexion (KPI « visites » de la page de supervision)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- 4. Statut des tickets de support (ouvert / traité)
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open';
ALTER TABLE public.support_messages DROP CONSTRAINT IF EXISTS support_messages_status_check;
ALTER TABLE public.support_messages
  ADD CONSTRAINT support_messages_status_check CHECK (status IN ('open', 'resolved'));
