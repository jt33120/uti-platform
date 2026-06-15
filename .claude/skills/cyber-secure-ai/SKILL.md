---
name: cyber-secure-ai
description: >
  Sécurise les projets et agents IA (stack FastAPI + Supabase + Vercel + LLM) en
  produisant soit un plan d'architecture sécurisé pour un nouveau projet, soit un
  audit de remédiation priorisé pour du code existant — avec un script d'audit
  déterministe et des snippets de code durci prêts à intégrer. Utilise impérativement
  cette skill dès que l'utilisateur parle de "sécuriser", "audit sécurité", "cyber",
  "secure my agent", "harden", "OWASP", "prompt injection", "RGPD/GDPR", "RLS",
  "auth JWT", "CORS", ou démarre/relit un backend FastAPI ou un agent LLM — même
  sans le mot "sécurité". À déclencher aussi quand l'utilisateur demande de
  reviewer la sécurité d'une API, d'un RAG ou d'un agent multi-tenant.
---

# Cyber Secure AI

Sécurise les projets IA construits sur **FastAPI + Supabase + Vercel + LLM**. Deux
modes, un seul objectif : passer d'une intention vague ("c'est sécurisé ?") à des
décisions concrètes et vérifiables.

## 1. Choisir le mode

Lire la demande et le contexte :

- **NOUVEAU PROJET** — l'utilisateur démarre (pas encore de code, ou squelette
  vide). → Produire le **plan d'architecture sécurisé** (section 2).
- **AUDIT EXISTANT** — du code existe. → Lancer le **script d'audit déterministe**
  puis produire la **checklist de remédiation priorisée** (section 3).

En cas de doute, demander : « Tu pars de zéro, ou tu as déjà du code à auditer ? »
Ne pas produire les deux livrables à la fois — ils répondent à des besoins
différents.

Dans les deux modes, finir en proposant les **snippets durcis** (`assets/`) adaptés
au cas, et brancher la question auth selon `references/auth.md`.

---

## 2. Mode NOUVEAU PROJET — plan d'architecture sécurisé

Produire un plan structuré dans cet ordre exact. Garder chaque section concrète et
adaptée à la stack réelle de l'utilisateur (ne pas réciter des généralités).

### A. Architecture réseau
- Chemin : `Internet → WAF → API FastAPI → [zone privée] → DB + LLM`.
- Un seul port exposé : 443.
- La DB n'est jamais joignable directement depuis internet. Avec Supabase, garder
  les clés `service_role` côté serveur uniquement, jamais dans le front Vercel.
- Accès admin/dev distant via VPN ou tunnel (pas d'exposition publique d'un port
  de debug).

### B. Authentification & autorisation
**Décision structurante — lire `references/auth.md` avant de trancher.** Sur une
stack Supabase, l'auth native (GoTrue + RLS) est souvent le bon choix ; un JWT
custom côté FastAPI duplique ou entre en conflit avec elle. Ne pas imposer le JWT
custom par défaut.

Principes communs aux deux branches :
- Durée de vie d'un access token courte (≤ 1 h) + refresh token.
- Token jamais en `localStorage` (vol via XSS) → cookie `httpOnly` + `Secure` +
  `SameSite`, ou stockage géré par le SDK Supabase.
- RBAC défini dès le départ : lister les rôles et leurs droits.
- Isolation des tenants : chaque utilisateur ne voit que ses données — appliquée
  par RLS côté Supabase, pas seulement par filtrage applicatif.
- MFA sur les comptes admin ; révocation rapide prévue (départ collaborateur).

### C. Sécurité de l'API FastAPI
Pointer vers les snippets `assets/secure_main.py` et `assets/security.py` plutôt
que de réécrire la config de tête. Les points non négociables :
- CORS : liste explicite de domaines, jamais `["*"]` avec credentials.
- Rate limiting obligatoire sur les endpoints qui appellent le LLM (coût + abus).
- `/docs` et `/redoc` désactivés en prod (`docs_url=None`).
- `debug=False` en prod ; les erreurs ne fuient pas de stack trace au client.
- Validation Pydantic stricte de tous les inputs (longueurs bornées).
- Headers durcis : pas de `Server`/`X-Powered-By` révélant le framework.

### D. Sécurité LLM, RAG & agent
- Filtrer les inputs **avant** le LLM (pattern matching ; LLM de garde si budget).
- Séparer données et instructions — ne jamais concaténer naïvement un document
  externe dans le prompt système.
- Sorties structurées (JSON schema strict) pour borner les actions possibles.
- RAG multi-tenant : filtrer par `tenant_id` **avant** la recherche vectorielle,
  jamais après. Désactiver le cache LLM partagé en multi-tenant.
- Traçabilité : qui a uploadé quoi, quels chunks ont servi à quelle réponse.
- Human-in-the-loop : toute action irréversible (envoi de mail, suppression,
  paiement) est interceptée au niveau du tool et confirmée.

### E. MLSecOps — pipeline CI/CD
Automatiser avant chaque déploiement (voir `scripts/audit.py`, conçu pour tourner
en CI) :
- `pip-audit` — CVE sur les dépendances.
- `trufflehog` — secrets dans l'historique git.
- Vérifs de config : `/docs` off, `debug=False`, CORS sans `*`, `.env` ignoré.

---

## 3. Mode AUDIT EXISTANT — remédiation priorisée

### Étape 1 — Lancer le script déterministe
Avant de raisonner, collecter des **preuves**. Exécuter :

```bash
python scripts/audit.py <chemin_du_projet>
```

Le script scanne le code (stdlib only, pas de dépendance), et si `pip-audit` /
`trufflehog` sont installés, les lance aussi. Il classe chaque finding en
`CRITIQUE` / `IMPORTANT` / `INFO` et retourne un code de sortie non nul s'il y a du
CRITIQUE — utilisable tel quel en CI. Voir l'entête du script pour la liste exacte
des règles.

### Étape 2 — Compléter par une revue manuelle
Le script attrape les motifs mécaniques. Compléter par ce que seul un humain (ou le
modèle) peut juger, en lisant le code pertinent :
- Logique d'isolation tenant réellement appliquée (RLS active, pas juste un filtre
  applicatif contournable).
- Concaténation données/instructions dans les prompts LLM.
- Actions irréversibles sans human-in-the-loop.
- Cohérence RBAC (un rôle peut-il accéder aux données d'un autre ?).

### Étape 3 — Produire la checklist priorisée
Restituer sous forme de tableau, regroupé par criticité, **avec l'emplacement
précis** (fichier:ligne) et la remédiation concrète. Ne pas noyer : viser les vrais
risques d'abord.

Matrice de priorisation :

| Criticité | Critère | Délai |
|-----------|---------|-------|
| CRITIQUE | Fuite de données, accès non autorisé, clé/secret exposé, injection | Immédiat |
| IMPORTANT | Monitoring absent, config manquante, écart RGPD | Avant prod |
| NICE TO HAVE | Durcissement supplémentaire, certifications | Roadmap |

Pour le détail des règles d'audit (inputs/injection, auth, config, RAG,
monitoring, supply chain), voir l'entête de `scripts/audit.py`.

---

## 4. Snippets durcis (assets)

Proposer ces fichiers en fin d'intervention, adaptés au projet — ne pas les
régénérer de tête :

- `assets/secure_main.py` — initialisation FastAPI durcie (docs off en prod, CORS
  explicite, headers de sécurité, handler d'erreur qui ne fuit rien).
- `assets/security.py` — dépendance de vérification de token (branche Supabase JWKS
  **et** branche secret partagé), `get_current_user`, garde RBAC, rate limiting.
- `assets/env.example` — variables attendues, sans aucune valeur réelle.

Adapter (domaines CORS, rôles, issuer Supabase) au contexte avant de les livrer.

---

## 5. Conformité & références

Détail réglementaire dans `references/compliance.md` (à lire quand l'utilisateur
touche au RGPD, à l'AI Act, NIS2, DORA, ou héberge des données sensibles). En
résumé :
- **OWASP Top 10 Web & LLM 2025** — broken access control, injection,
  misconfiguration ; prompt injection, excessive agency, system prompt leakage.
- **AI Act** — classement/évaluation automatique de personnes (recrutement, etc.)
  = haut risque → documentation + supervision humaine obligatoires.
- **NIS2** — notification d'incident sous 24 h, sécurité de la supply chain.
- **RGPD** — minimisation, durée de conservation, droit à l'effacement, DPA client.

---

*Base : formation cyber + OWASP/AI Act/NIS2/RGPD — itéré 2026.*
