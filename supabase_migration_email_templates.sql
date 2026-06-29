-- Templates d'emails éditables (Administration → Templates Mails).
-- Le code retombe sur des valeurs par défaut si la table/ligne est absente,
-- donc cette migration est non bloquante.
CREATE TABLE IF NOT EXISTS public.email_templates (
  key        text PRIMARY KEY,           -- 'ao_new' | 'ao_relance'
  subject    text NOT NULL,
  body       text NOT NULL,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
