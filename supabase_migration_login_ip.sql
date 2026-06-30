-- Historique de connexion : IP publique de la dernière connexion.
-- Donnée personnelle (RGPD) — base légale : intérêt légitime (sécurité des accès,
-- détection d'accès anormaux). À mentionner dans la politique de confidentialité.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_login_ip text;
