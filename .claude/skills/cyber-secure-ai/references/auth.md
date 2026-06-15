# Auth — Supabase-native vs JWT custom

Décision structurante à trancher AVANT d'écrire la moindre ligne d'auth. Les deux
approches sont valides, mais les mélanger crée des failles (deux sources de vérité
sur l'identité) et de la dette.

## Branche A — Supabase-native (recommandée sur cette stack)

Supabase (GoTrue) émet et gère déjà les JWT. Le front utilise le SDK
`supabase-js` ; la session est gérée par le SDK (pas de manipulation manuelle de
token en `localStorage`).

- **Identité** : le front envoie le JWT Supabase dans `Authorization: Bearer ...`.
  Le backend FastAPI le **vérifie** (JWKS ou secret partagé — voir
  `assets/security.py`) mais ne l'émet pas.
- **Autorisation / isolation tenant** : portée par les **policies RLS** côté
  Postgres. C'est le point clé — l'isolation est appliquée par la base, pas par du
  filtrage applicatif contournable. Chaque requête passe le JWT à Supabase qui
  applique `auth.uid()` dans les policies.
- **service_role** : contourne RLS. À n'utiliser que côté serveur pour des tâches
  d'admin explicites, jamais exposé au front.
- **Piège classique** : faire un endpoint FastAPI qui lit la DB avec la clé
  `service_role` puis filtre en Python par `user_id`. Ça court-circuite RLS — une
  erreur de filtre = fuite cross-tenant. Préférer propager le JWT utilisateur.

Quand la choisir : tu utilises déjà Supabase Auth, ou tu veux l'isolation forte de
RLS sans réimplémenter l'autorisation.

## Branche B — JWT custom

Tu émets toi-même les tokens (login → signature → vérification côté API). Tu gères
toi-même les rôles, l'expiration, le refresh, la révocation.

- Pertinent si l'auth ne passe pas par Supabase (IdP externe, besoins spécifiques),
  ou si la DB n'est pas Postgres/Supabase.
- Tu portes alors **toute** la charge de l'isolation tenant côté applicatif : à
  tester rigoureusement (un rôle ne doit jamais lire les données d'un autre).
- Token court (≤ 1 h) + refresh token. Stockage en cookie `httpOnly`+`Secure`+
  `SameSite`, jamais en `localStorage`.

Quand la choisir : pas de Supabase Auth, ou contrainte qui l'impose.

## Règle commune

- Jamais de token en `localStorage`/`sessionStorage` (vol via XSS).
- MFA sur les comptes admin.
- Révocation rapide prévue dès le départ (départ collaborateur, fuite de token).
- RBAC : lister les rôles et leurs droits avant de coder.
