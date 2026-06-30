-- MFA (authentification à deux facteurs, TOTP) — obligatoire pour tous.
-- Chaque profil porte son secret TOTP (base32) et un drapeau d'activation.
-- À défaut de ces colonnes, le backend retombe sur une connexion classique
-- (le code reste fonctionnel même sans la migration).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mfa_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mfa_secret text;
