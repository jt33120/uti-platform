# Gouvernance des données (Art. 10)

> Statut : 🟥 À FAIRE · Responsable : Produit / Data · Dernière mise à jour : 2026-06-17
> Article AI Act : Art. 10

## 1. Particularité du système

Le moteur **n'est pas entraîné** par UTI : il s'appuie sur un LLM tiers (Claude
3.5 Haiku) en **inférence à la volée**. Il n'y a donc pas de jeu
d'entraînement/validation/test au sens classique. La gouvernance des données
porte sur :
1. les **données d'entrée** (CV, AO) — leur qualité et pertinence ;
2. le **jeu de test de biais** que UTI constitue pour évaluer le système
   ([plan de test de biais](03-plan-test-biais.md)) ;
3. la **grille de scoring** (features retenues) en architecture hybride.

## 2. Qualité & pertinence des données d'entrée

| Critère | Exigence | Mesure |
|---------|----------|--------|
| Exactitude | CV à jour et authentiques | Flow-down partenaires (Art. 26) ; consentement |
| Pertinence | Seules les features liées au poste sont scorées | Grille : compétences, séniorité, contexte, TJM |
| Complétude | CV lisible (texte ≥ 50 caractères) | Contrôle déjà présent (`submissions.py`) |
| Minimisation | Pas de données superflues envoyées au LLM | **Pseudonymisation** (retrait nom/contact) |

## 3. Examen des biais (exigence centrale sur l'emploi)

Variables à risque de biais **indirect** dans un CV :

| Signal | Vecteur | Mesure corrective |
|--------|---------|-------------------|
| Genre | Prénom, civilité, accords | Pseudonymisation + scoring déterministe sur features |
| Âge | Dates de diplôme, années d'expérience | Borner le poids de l'ancienneté ; pas de date brute scorée |
| Origine | Nom, nationalité, langues | Pseudonymisation ; ne pas scorer la nationalité |
| Handicap | Mentions éventuelles | Ne jamais scorer ; exclure du prompt |

> **Principe** : ne scorer que des **features explicites et justifiables**
> (compétences techniques, séniorité, adéquation contexte, TJM). Le texte brut du
> CV, porteur de signaux sensibles, ne doit pas piloter le score en architecture
> cible.

## 4. Features retenues pour le scoring (grille)

| Feature | Poids | Source | Justification métier |
|---------|-------|--------|----------------------|
| Compétences techniques | 40 | `skills` ∩ `skills_required` | Cœur de l'adéquation au poste |
| Séniorité | 20 | `experience_years` | Niveau requis par l'AO |
| Contexte / secteur | 20 | secteur AO vs parcours | Familiarité métier |
| Compatibilité TJM | 20 | `tjm` vs `budget_max` | Contrainte budgétaire |

## 5. Mesures correctives — suivi

- [ ] Pseudonymisation de l'entrée LLM (Phase 3)
- [ ] Scoring déterministe sur features (Phase 3)
- [ ] Jeu de test de biais constitué et exécuté (Phase 2 — [plan](03-plan-test-biais.md))
- [ ] Documentation des poids et de leur justification (ci-dessus)
