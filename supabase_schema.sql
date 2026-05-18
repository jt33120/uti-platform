-- ============================================================
-- G-IT Plateforme Partenaires — Supabase Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Profiles (linked to Supabase Auth users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('admin', 'ao')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Clients
--    Dimension de cloisonnement : chaque AO et chaque partenaire
--    sont rattachés à un ou plusieurs clients.
CREATE TABLE IF NOT EXISTS public.clients (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  description   TEXT,
  sector        TEXT,
  logo_url      TEXT,
  contact_name  TEXT,
  contact_email TEXT,
  created_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Appels d'Offres
--    Rattaché à un client (cloisonnement).
CREATE TABLE IF NOT EXISTS public.appels_offres (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  title            TEXT NOT NULL,
  description      TEXT NOT NULL,
  skills_required  TEXT NOT NULL,       -- Comma-separated skills (used by AI matching)
  budget_max       INT,                 -- Taux journalier max (€/jour)
  location         TEXT,
  duration         TEXT,
  context          TEXT,                -- Additional context passed to AI
  ao_type          TEXT,                -- Type d'AO (ex: Assurance, Banque/Finance, IT/Dev)
  status           TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Consultants
--    Roster géré par les partenaires (role='ao').
--    Un consultant est soumis à un AO via la table submissions.
CREATE TABLE IF NOT EXISTS public.consultants (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  tjm              INT,                 -- Taux journalier moyen (€/jour)
  skills           TEXT NOT NULL,       -- Comma-separated skills
  experience_years INT,
  availability     TEXT,
  employment_type  TEXT CHECK (employment_type IN ('independant', 'salarie')),
  email            TEXT,
  phone            TEXT,
  cv_url           TEXT,                -- Public URL from Supabase Storage (legacy — CVs now on submissions)
  cv_text          TEXT,
  cv_filename      TEXT,
  created_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Partner ↔ Client access matrix
--    Defines which partners can see which clients and at what priority tier.
--    tier = 'list_1' : prioritaire
--    tier = 'list_2' : standard
--    tier = 'suspended' : accès bloqué
CREATE TABLE IF NOT EXISTS public.partner_clients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id   UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tier        TEXT NOT NULL CHECK (tier IN ('list_1', 'list_2', 'suspended')),
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (partner_id, client_id)
);

-- 6. Submissions (CV soumis à un AO)
--    Pivot AO ↔ CV ↔ partenaire.
--    Un partenaire soumet le CV d'un consultant à un AO précis.
--    L'unicité (ao_id, consultant_id) empêche les doublons.
CREATE TABLE IF NOT EXISTS public.submissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ao_id         UUID NOT NULL REFERENCES public.appels_offres(id) ON DELETE CASCADE,
  consultant_id UUID NOT NULL REFERENCES public.consultants(id) ON DELETE CASCADE,
  submitted_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  cv_url        TEXT,                   -- Public URL from Supabase Storage
  cv_text       TEXT,                   -- Extracted text from PDF
  cv_filename   TEXT,
  submitted_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (ao_id, consultant_id)
);

-- 7. Matchings (AI scoring results)
CREATE TABLE IF NOT EXISTS public.matchings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ao_id            UUID REFERENCES public.appels_offres(id) ON DELETE CASCADE,
  submission_id    UUID REFERENCES public.submissions(id) ON DELETE SET NULL,  -- pivot AO ↔ CV ↔ partenaire
  consultant_id    TEXT NOT NULL,        -- String to handle GPT responses
  score_total      INT NOT NULL,
  breakdown        JSONB,               -- { competences, seniorite, contexte, tjm }
  points_forts     JSONB,               -- Array of strings
  points_faibles   JSONB,               -- Array of strings
  resume_matching  TEXT,
  recommandation   TEXT,
  rank             INT,
  cost_usd         NUMERIC(10, 4) DEFAULT 0,
  ran_by           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Partner invitations
CREATE TABLE IF NOT EXISTS public.invitations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token      TEXT NOT NULL UNIQUE,
  email      TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'ao' CHECK (role IN ('admin', 'ao')),
  invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  used_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultants    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appels_offres  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations    ENABLE ROW LEVEL SECURITY;

-- profiles: read own; backend writes via service role
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- clients: all authenticated can read (access filtering done in backend)
CREATE POLICY "clients_select_all" ON public.clients
  FOR SELECT TO authenticated USING (true);

-- consultants: all authenticated can read
CREATE POLICY "consultants_select_all" ON public.consultants
  FOR SELECT TO authenticated USING (true);

-- consultants: partner can insert their own
CREATE POLICY "consultants_insert_own" ON public.consultants
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

-- consultants: partner can delete their own
CREATE POLICY "consultants_delete_own" ON public.consultants
  FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- appels_offres: all authenticated can read
CREATE POLICY "aos_select_all" ON public.appels_offres
  FOR SELECT TO authenticated USING (true);

-- partner_clients: all authenticated can read (access filtering done in backend)
CREATE POLICY "partner_clients_select_all" ON public.partner_clients
  FOR SELECT TO authenticated USING (true);

-- submissions: all authenticated can read (access filtering done in backend)
CREATE POLICY "submissions_select_all" ON public.submissions
  FOR SELECT TO authenticated USING (true);

-- matchings: all authenticated can read
CREATE POLICY "matchings_select_all" ON public.matchings
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- Storage bucket for CVs
-- ============================================================
-- Run in Supabase Storage: create a bucket named "cvs"
-- Set it to PUBLIC for easy CV URL access (or use signed URLs for private access)
-- Path convention: {ao_id}/{submission_uuid}.pdf

-- ============================================================
-- Indexes
-- ============================================================

-- Migration: add ao_type to existing databases
ALTER TABLE public.appels_offres ADD COLUMN IF NOT EXISTS ao_type TEXT;

CREATE INDEX IF NOT EXISTS idx_clients_created_at       ON public.clients(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consultants_created_by   ON public.consultants(created_by);
CREATE INDEX IF NOT EXISTS idx_consultants_created_at   ON public.consultants(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aos_client_id            ON public.appels_offres(client_id);
CREATE INDEX IF NOT EXISTS idx_aos_status               ON public.appels_offres(status);
CREATE INDEX IF NOT EXISTS idx_aos_created_at           ON public.appels_offres(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_clients_partner  ON public.partner_clients(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_clients_client   ON public.partner_clients(client_id);
CREATE INDEX IF NOT EXISTS idx_submissions_ao_id        ON public.submissions(ao_id);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_by ON public.submissions(submitted_by);
CREATE INDEX IF NOT EXISTS idx_matchings_ao_id          ON public.matchings(ao_id);
CREATE INDEX IF NOT EXISTS idx_matchings_rank           ON public.matchings(ao_id, rank);
