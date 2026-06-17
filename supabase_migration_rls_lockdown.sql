-- ============================================================
-- Durcissement RLS — verrouillage de l'accès client direct (deny-all)
-- À exécuter dans Supabase → SQL Editor (idempotent).
-- ============================================================
--
-- ⚠️ CRITIQUE — la base live portait des policies « poc_* » accordant au rôle
-- `public` (donc anon = tout le monde) un accès « ALL USING (true) » sur
-- profiles, clients, appels_offres, consultants, invitations, matchings, etc.
-- → lecture ET écriture/suppression par n'importe qui via l'API REST publique
-- (dont : lire tous les emails, s'auto-promouvoir admin, forger des invitations).
--
-- Modèle de sécurité de l'app :
--   • Le backend FastAPI accède à la base avec la clé `service_role`, qui
--     CONTOURNE la RLS et applique lui-même l'autorisation (rôles + filtres).
--   • Le frontend ne parle JAMAIS à Supabase en direct (aucune dépendance
--     @supabase/*). L'app n'a donc AUCUN besoin d'accès client direct.
--
-- → On supprime TOUTES les policies du schéma public (les noms varient :
--   poc_*, *_select_all, *_select_own…), et on garde la RLS ACTIVÉE partout.
--   Résultat : deny-all par défaut pour anon/authenticated ; le backend
--   (service_role) n'est pas affecté.

-- 1) Supprimer dynamiquement toutes les policies du schéma public.
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

-- 2) Garantir la RLS ACTIVÉE sur toutes les tables du schéma public
--    (deny-all sans policy).
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

-- 3) Vérifications (la 1re doit renvoyer 0 ligne) :
-- SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';
-- SELECT relname, relrowsecurity FROM pg_class c
--   JOIN pg_namespace n ON n.oid = c.relnamespace
--   WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY relname;  -- tout à true
