-- Templates d'emails éditables (Administration → Templates Mails).
-- Le code retombe sur des valeurs par défaut si la table/ligne est absente,
-- donc cette migration est non bloquante.
CREATE TABLE IF NOT EXISTS public.email_templates (
  key        text PRIMARY KEY,           -- 'ao_new' | 'ao_relance'
  subject    text NOT NULL,
  body       text NOT NULL,              -- HTML (éditeur visuel riche)
  format     text NOT NULL DEFAULT 'html', -- 'html' | 'text' (legacy)
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ajout idempotent de la colonne `format` si la table existe déjà.
ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS format text NOT NULL DEFAULT 'html';
