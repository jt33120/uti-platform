-- ============================================================
-- Pièces jointes d'origine d'un AO (pour « Edit AO = Create AO »)
-- À exécuter dans le SQL Editor du projet UTI.
-- ============================================================
-- Additif et idempotent. Stocke les métadonnées des fichiers source (email/PDF/
-- DOCX) déposés à la création ; les binaires vont dans le bucket privé
-- "ao-sources". Le backend dégrade proprement si la colonne n'existe pas.
--
-- Forme : [{"name":"ao.pdf","path":"<ao_id>/<token>-ao.pdf",
--           "content_type":"application/pdf","size":12345}, ...]
ALTER TABLE public.appels_offres ADD COLUMN IF NOT EXISTS source_files JSONB;

-- ── Bucket de stockage ──────────────────────────────────────────────────────
-- En backend Supabase Storage, créer un bucket PRIVÉ "ao-sources" (le backend
-- tente aussi de le créer automatiquement). En backend S3/OVH, rien à faire :
-- "ao-sources" devient un simple préfixe de clés dans le bucket OVH unique.
INSERT INTO storage.buckets (id, name, public)
VALUES ('ao-sources', 'ao-sources', false)
ON CONFLICT (id) DO NOTHING;
