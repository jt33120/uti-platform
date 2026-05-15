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

-- 2. Consultants
CREATE TABLE IF NOT EXISTS public.consultants (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  tjm              INT,                    -- Taux journalier moyen (€/jour)
  skills           TEXT NOT NULL,          -- Comma-separated skills
  experience_years INT,
  availability     TEXT,
  cv_url           TEXT,                   -- Public URL from Supabase Storage
  cv_text          TEXT,                   -- Extracted text from PDF
  cv_filename      TEXT,
  created_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Appels d'Offres
CREATE TABLE IF NOT EXISTS public.appels_offres (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT NOT NULL,
  description      TEXT NOT NULL,
  skills_required  TEXT NOT NULL,
  budget_max       INT,
  location         TEXT,
  duration         TEXT,
  context          TEXT,
  status           TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Matchings (AI scoring results)
CREATE TABLE IF NOT EXISTS public.matchings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ao_id            UUID REFERENCES public.appels_offres(id) ON DELETE CASCADE,
  consultant_id    TEXT NOT NULL,           -- String to handle GPT responses
  score_total      INT NOT NULL,
  breakdown        JSONB,                   -- { competences, seniorite, contexte, tjm }
  points_forts     JSONB,                   -- Array of strings
  points_faibles   JSONB,                   -- Array of strings
  resume_matching  TEXT,
  recommandation   TEXT,
  rank             INT,
  cost_usd         NUMERIC(10, 4) DEFAULT 0,  -- Cost in USD for this matching run
  ran_by           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Partner invitations
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
ALTER TABLE public.consultants    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appels_offres  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations    ENABLE ROW LEVEL SECURITY;

-- profiles: read own, backend writes via service role
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- consultants: all authenticated can read
CREATE POLICY "consultants_select_all" ON public.consultants
  FOR SELECT TO authenticated USING (true);

-- consultants: AO can insert their own
CREATE POLICY "consultants_insert_own" ON public.consultants
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

-- consultants: AO can update/delete their own, admin can all
-- (simplified — the backend enforces this via JWT role)
CREATE POLICY "consultants_delete_own" ON public.consultants
  FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- appels_offres: all authenticated can read
CREATE POLICY "aos_select_all" ON public.appels_offres
  FOR SELECT TO authenticated USING (true);

-- matchings: all authenticated can read
CREATE POLICY "matchings_select_all" ON public.matchings
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- Storage bucket for CVs
-- ============================================================
-- Run in Supabase Storage: create a bucket named "cvs"
-- Set it to PUBLIC for easy CV URL access
-- Or use signed URLs for private access

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_consultants_created_by ON public.consultants(created_by);
CREATE INDEX IF NOT EXISTS idx_consultants_created_at ON public.consultants(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aos_status             ON public.appels_offres(status);
CREATE INDEX IF NOT EXISTS idx_aos_created_at         ON public.appels_offres(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_matchings_ao_id        ON public.matchings(ao_id);
CREATE INDEX IF NOT EXISTS idx_matchings_rank         ON public.matchings(ao_id, rank);
