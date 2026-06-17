-- ============================================================
-- Durcissement STORAGE — fermer l'accès public direct aux fichiers
-- À exécuter dans Supabase → SQL Editor (idempotent).
-- ============================================================
--
-- Constat : storage.objects portait des policies « ALLOW ALL » accordées au
-- rôle `public` en SELECT/INSERT/UPDATE/DELETE → n'importe qui (même non
-- authentifié) pouvait lire, téléverser, écraser et SUPPRIMER tout fichier
-- (CV, avatars, logos) via l'API Storage. Inacceptable.
--
-- Modèle cible (cohérent avec le reste de l'app) :
--   • Upload / suppression : uniquement le backend (clé service_role, ignore RLS).
--   • Lecture des CV : URLs SIGNÉES générées par le backend (bucket privé).
--   • Lecture des avatars/logos : bucket public (lecture publique par design,
--     sans policy — peu sensible).
-- → On supprime TOUTES les policies de storage.objects : service_role et les
--   URLs signées continuent de fonctionner ; l'accès direct anon est coupé.

DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p.policyname);
  END LOOP;
END $$;

-- Passer le bucket des CV en PRIVÉ (les avatars/logos restent publics).
UPDATE storage.buckets SET public = false WHERE id = 'cvs';

-- Vérifications :
-- SELECT id, name, public FROM storage.buckets;                 -- cvs => public=false
-- SELECT policyname, cmd, roles FROM pg_policies
--   WHERE schemaname='storage' AND tablename='objects';         -- => 0 ligne
--
-- ⚠️ Si le DROP/UPDATE renvoie « permission denied » (selon les droits du rôle
-- du SQL Editor), fais-le via l'UI : Storage → Policies (supprime les 4
-- « ALLOW ALL ») et Storage → bucket « cvs » → Settings → décoche « Public ».
