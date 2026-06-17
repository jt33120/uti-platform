-- ============================================================
-- Durcissement RLS — verrouillage de l'accès client direct
-- À exécuter dans Supabase → SQL Editor (idempotent).
-- ============================================================
--
-- Modèle de sécurité de l'app :
--   • Le backend FastAPI accède à la base avec la clé `service_role`, qui
--     CONTOURNE la RLS. C'est lui — et lui seul — qui applique l'autorisation
--     (rôles admin/commerce/ao + filtres created_by / partner_clients).
--   • Le frontend ne parle JAMAIS à Supabase en direct (aucune dépendance
--     @supabase/*). L'app n'a donc AUCUN besoin d'accès client (anon/authenticated).
--
-- Conséquence : les anciennes policies « SELECT USING (true) » étaient dormantes
-- pour l'app, mais exposaient une LECTURE CROSS-TENANT via l'API REST publique
-- (https://<ref>.supabase.co/rest/v1) à quiconque dispose de la clé anon + d'un
-- JWT `authenticated`. On les supprime. RLS reste ACTIVÉE → sans policy, l'accès
-- direct est intégralement refusé. Le backend (service_role) n'est pas affecté.

-- 1) Supprimer toutes les policies d'accès direct (permissives ou non — l'app
--    n'en a besoin d'aucune).
DROP POLICY IF EXISTS "profiles_select_own"        ON public.profiles;
DROP POLICY IF EXISTS "clients_select_all"         ON public.clients;
DROP POLICY IF EXISTS "consultants_select_all"     ON public.consultants;
DROP POLICY IF EXISTS "consultants_insert_own"     ON public.consultants;
DROP POLICY IF EXISTS "consultants_delete_own"     ON public.consultants;
DROP POLICY IF EXISTS "aos_select_all"             ON public.appels_offres;
DROP POLICY IF EXISTS "partner_clients_select_all" ON public.partner_clients;
DROP POLICY IF EXISTS "submissions_select_all"     ON public.submissions;
DROP POLICY IF EXISTS "matchings_select_all"       ON public.matchings;
DROP POLICY IF EXISTS "support_insert_own"         ON public.support_messages;

-- 2) Garantir que la RLS reste ACTIVÉE partout (deny-all par défaut, sans policy).
ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultants      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appels_offres    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_clients  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- 3) Vérification (doit renvoyer 0 ligne = aucune policy d'accès direct restante).
-- SELECT tablename, policyname, cmd, roles, qual
-- FROM pg_policies WHERE schemaname = 'public';
