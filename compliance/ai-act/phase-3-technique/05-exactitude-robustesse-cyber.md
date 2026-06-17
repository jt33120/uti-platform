# Exactitude, robustesse & cybersécurité (Art. 15)

> Statut : 🟧 EN COURS · Responsable : Dev · Dernière mise à jour : 2026-06-17
> Article AI Act : Art. 15

## 1. Exactitude

| Exigence | Mesure | Statut |
|----------|--------|--------|
| Niveau de précision déclaré | Mesuré via le jeu de test ([biais/précision](../phase-2-risques-donnees/03-plan-test-biais.md)) | 🟥 |
| Métriques publiées dans la notice | À renseigner après tests (Art. 13) | 🟥 |
| Cohérence du scoring | Scoring déterministe (architecture hybride) | 🟥 |

## 2. Robustesse

| Exigence | Mesure | Statut |
|----------|--------|--------|
| Reproductibilité | `temperature=0` + scoring déterministe | 🟥 |
| Gestion d'erreurs | Le pipeline ne casse pas sur 1 CV illisible ; fallback documenté | 🟧 |
| Résistance aux entrées anormales | Validation MIME/taille déjà en place (`submissions.py`) | 🟩 |
| Dégradation maîtrisée | En cas d'échec LLM, comportement défini (pas de score fantôme) | 🟧 |

## 3. Cybersécurité (déjà largement traité ✅)

| Exigence | Mesure | Statut |
|----------|--------|--------|
| Cloisonnement base | RLS **deny-all** sur toutes les tables ; backend `service_role` | 🟩 |
| Stockage des CV | Bucket `cvs` **privé** + **URLs signées** courtes | 🟩 |
| Bucket avatars | Public (assumé, données non sensibles) | 🟩 |
| Secrets | `JWT_SECRET` fail-closed en prod ; clés non committées | 🟩 |
| En-têtes de sécurité | `x-frame-options: DENY`, `x-content-type-options: nosniff` | 🟩 |
| Transport | HTTPS (Vercel + backend OVH) | 🟩 |

> Le volet cyber a été durci lors du chantier sécurité précédent (RLS, clés,
> URLs signées). Il reste à **documenter** ces mesures dans le dossier technique
> Annexe IV.

## 4. Attaques spécifiques IA à considérer

| Attaque | Parade |
|---------|--------|
| Injection de prompt via CV | Le CV ne pilote plus le score (architecture hybride) ; extraction à sortie structurée stricte |
| Empoisonnement des entrées | Flow-down partenaires (données exactes) ; validation |
| Extraction de données du modèle | Pseudonymisation ; pas de données sensibles dans le prompt |

## 5. À produire

- [ ] Niveau de précision mesuré et déclaré
- [ ] Procédure de dégradation maîtrisée documentée
- [ ] Report des mesures cyber dans le dossier Annexe IV
