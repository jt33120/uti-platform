-- MFA activable/désactivable par compte (active par défaut).
-- mfa_required = true  -> second facteur obligatoire (comportement par défaut)
-- mfa_required = false -> compte exonéré de MFA par un administrateur
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mfa_required boolean NOT NULL DEFAULT true;
