-- ============================================================
-- RLS par rôle — pour un consommateur Supabase EN DIRECT (front Angular MIP).
-- À exécuter dans le SQL Editor du projet UTI (ref zeaqvlbimsstzgiabvrr).
-- ============================================================
--
-- ⚠️ PRÉREQUIS ABSOLU : ce consommateur DOIT s'authentifier via Supabase Auth
-- (supabase-js sign-in) pour que `auth.uid()` = profiles.id. S'il envoie le JWT
-- custom de l'API FastAPI, `auth.uid()` est NULL → is_staff() NULL → TOUT LE
-- MONDE voit 0 (admin compris). C'est la cause du « admin = 0 partout ».
--
-- Le backend FastAPI (service_role) CONTOURNE la RLS : il n'est pas concerné.
-- Modèle : LECTURE scopée par rôle ci-dessous ; ÉCRITURES = backend uniquement
-- (aucune policy INSERT/UPDATE/DELETE → refus direct, anti-escalade de rôle).
--
-- Rôles applicatifs : 'admin' & 'commerce' = staff (voient tout) ;
--                     'ao' = partenaire (voit selon partner_clients).

-- 0) Repartir propre : supprimer toutes les policies existantes du schéma public.
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT tablename, policyname FROM pg_policies WHERE schemaname='public'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename); END LOOP;
END $$;

-- 1) Helpers SECURITY DEFINER (bypass RLS → pas de récursion sur profiles).
CREATE OR REPLACE FUNCTION public.current_app_role()
  RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$ SELECT role FROM public.profiles WHERE id = auth.uid() $$;
REVOKE ALL ON FUNCTION public.current_app_role() FROM public;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_staff()
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$ SELECT coalesce(public.current_app_role() IN ('admin','commerce'), false) $$;
REVOKE ALL ON FUNCTION public.is_staff() FROM public;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

-- 2) profiles : chacun se voit ; le staff voit tout. (Écritures via backend.)
CREATE POLICY profiles_select_self  ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY profiles_select_staff ON public.profiles FOR SELECT TO authenticated USING (public.is_staff());

-- 3) clients : staff = tout ; partenaire = ses clients (list_1/list_2).
CREATE POLICY clients_select_staff   ON public.clients FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY clients_select_partner ON public.clients FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.partner_clients pc
                 WHERE pc.client_id = clients.id AND pc.partner_id = auth.uid()
                   AND pc.tier IN ('list_1','list_2')));

-- 4) appels_offres : staff = tout ; partenaire = AO des clients accessibles.
CREATE POLICY aos_select_staff   ON public.appels_offres FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY aos_select_partner ON public.appels_offres FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.partner_clients pc
                 WHERE pc.client_id = appels_offres.client_id AND pc.partner_id = auth.uid()
                   AND pc.tier IN ('list_1','list_2')));

-- 5) partner_clients : staff = tout ; partenaire = ses propres lignes.
CREATE POLICY pc_select_staff ON public.partner_clients FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY pc_select_self  ON public.partner_clients FOR SELECT TO authenticated USING (partner_id = auth.uid());

-- 6) consultants (vivier) : staff = tout ; partenaire = ceux qu'il a créés.
CREATE POLICY consultants_select_staff ON public.consultants FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY consultants_select_owner ON public.consultants FOR SELECT TO authenticated USING (created_by = auth.uid());

-- 7) submissions : staff = tout ; partenaire = ses propres soumissions.
CREATE POLICY submissions_select_staff ON public.submissions FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY submissions_select_owner ON public.submissions FOR SELECT TO authenticated USING (submitted_by = auth.uid());

-- 8) matchings : staff = tout ; partenaire = matchings de SES soumissions.
CREATE POLICY matchings_select_staff ON public.matchings FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY matchings_select_owner ON public.matchings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.submissions s
                 WHERE s.id = matchings.submission_id AND s.submitted_by = auth.uid()));

-- 9) invitations & support_messages : AUCUNE policy → lecture directe refusée
--    (tokens d'invitation sensibles ; tickets). Accès via backend uniquement.

-- 10) RLS activée partout (deny-all par défaut là où aucune policy n'autorise).
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public'
  LOOP EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename); END LOOP;
END $$;

-- Vérif : connecté en Supabase Auth comme un admin → doit voir tous les AO.
-- Anonyme (anon, sans session) → auth.uid() NULL → ne voit rien. ✓
