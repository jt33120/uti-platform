-- ============================================================================
-- Migration : hiérarchie de clients (organisation parente + périmètre)
--             + garde-fou anti-doublon (similarité de noms)
--
-- Contexte : le champ clients.name mélangeait l'organisation et le périmètre
-- de référencement (ex. « AGIRC ARRCO : AMOA », « AGIRC ARRCO : SAD »), ce qui
-- donnait l'impression de doublons. On introduit :
--   - parent_client_id : rattache un périmètre à son organisation parente
--   - perimetre        : le libellé du périmètre (AMOA, SAD, SI, ...)
-- Les lignes existantes ne sont PAS supprimées ni déplacées : aucun AO ni
-- rattachement partenaire n'est touché. On ajoute seulement des lignes
-- « organisation parente » et on renseigne parent_client_id / perimetre.
--
-- Idempotent : ré-exécutable sans effet de bord.
-- ============================================================================

-- 1. Colonnes -----------------------------------------------------------------
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS parent_client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS perimetre TEXT;

CREATE INDEX IF NOT EXISTS idx_clients_parent ON public.clients(parent_client_id);

-- 2. Garde-fou anti-faute de frappe (similarité trigramme, best-effort) --------
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_clients_name_trgm ON public.clients USING gin (name gin_trgm_ops);

-- 3. Regroupement des données existantes --------------------------------------

-- 3a. Organisations parentes (créées seulement si absentes)
INSERT INTO public.clients (name, sector)
SELECT 'AGIRC ARRCO', 'Assurance'
WHERE NOT EXISTS (SELECT 1 FROM public.clients WHERE LOWER(name) = LOWER('AGIRC ARRCO'));

INSERT INTO public.clients (name, sector)
SELECT 'Groupe France Télévisions', 'Télécoms & Média'
WHERE NOT EXISTS (SELECT 1 FROM public.clients WHERE LOWER(name) = LOWER('Groupe France Télévisions'));

-- 3b. Enfants AGIRC ARRCO : rattachement + périmètre + secteur
UPDATE public.clients c SET
  parent_client_id = (SELECT id FROM public.clients WHERE name = 'AGIRC ARRCO'),
  perimetre        = TRIM(SPLIT_PART(c.name, ':', 2)),
  sector           = COALESCE(NULLIF(c.sector, ''), 'Assurance')
WHERE c.name IN (
  'AGIRC ARRCO : AMOA',
  'AGIRC ARRCO : DATA + IA',
  'AGIRC ARRCO : SAD',
  'AGIRC ARRCO : SID'
);

-- 3c. Enfants Groupe France Télévisions
UPDATE public.clients SET
  parent_client_id = (SELECT id FROM public.clients WHERE name = 'Groupe France Télévisions'),
  perimetre        = 'Référencement Data'
WHERE name = 'Groupe France Télévisions Référencement Data';

UPDATE public.clients SET
  parent_client_id = (SELECT id FROM public.clients WHERE name = 'Groupe France Télévisions'),
  perimetre        = 'Référencement Numérique'
WHERE name = 'Groupe France Télévisions Référencement Numérique';

-- 3d. Périmètre des clients autonomes (extrait du suffixe après « : »)
UPDATE public.clients SET
  perimetre = TRIM(SPLIT_PART(name, ':', 2))
WHERE perimetre IS NULL
  AND parent_client_id IS NULL
  AND name LIKE '%:%';

-- 3e. Remplissage des secteurs vides
UPDATE public.clients SET sector = 'Assurance'
  WHERE name = 'APICIL : SI' AND (sector IS NULL OR sector = '');
UPDATE public.clients SET sector = 'Secteur Public'
  WHERE name = 'CDC : AMOA' AND (sector IS NULL OR sector = '');
UPDATE public.clients SET sector = 'Santé & Pharma'
  WHERE name = 'CNOM : SI' AND (sector IS NULL OR sector = '');
