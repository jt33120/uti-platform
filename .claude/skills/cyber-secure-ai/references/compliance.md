# Conformité & cadres réglementaires

À lire quand le projet touche aux données personnelles, à l'évaluation automatique
de personnes, ou opère dans un secteur régulé. Ne pas réciter intégralement — citer
ce qui s'applique au projet.

## OWASP Top 10 — Web 2025 (extraits pertinents)
- **Broken access control** — vérifier l'autorisation sur chaque endpoint, pas
  seulement l'authentification. Première cause de fuite.
- **Injection** — SQL, mais aussi commandes et prompts. Inputs validés (Pydantic),
  requêtes paramétrées.
- **Security misconfiguration** — `/docs` exposés, `debug=True`, CORS `*`, headers
  bavards, défauts non changés.

## OWASP Top 10 — LLM 2025 (extraits)
- **Prompt injection** — un input (ou un document RAG) qui détourne les
  instructions. Séparer données et instructions ; ne jamais concaténer naïvement.
- **Excessive agency** — l'agent peut déclencher des actions au-delà du nécessaire.
  Borner les tools ; human-in-the-loop sur l'irréversible.
- **System prompt leakage** — ne pas mettre de secret dans le prompt système ;
  partir du principe qu'il peut fuiter.
- **Sensitive information disclosure** — filtrer ce que le LLM renvoie (PII, données
  d'autres tenants via un RAG mal cloisonné).

## AI Act (UE)
- Classement par niveau de risque. **Haut risque** : systèmes qui évaluent ou
  classent des personnes — recrutement, scoring, tri de candidats.
- Pour un système haut risque : documentation technique, journalisation,
  **supervision humaine** obligatoire, gestion des risques, qualité des données.
- Conséquence concrète : un agent de matching candidat/poste tombe probablement en
  haut risque → prévoir traçabilité des décisions et un humain dans la boucle.

## NIS2 (UE)
- Vise les entités essentielles/importantes (dont beaucoup d'ESN et leurs clients).
- **Notification d'incident significatif sous 24 h** (alerte précoce).
- **Sécurité de la supply chain** : auditer les dépendances et sous-traitants.
- Responsabilité au niveau de la direction.

## DORA (secteur financier UE)
- Résilience opérationnelle numérique pour les entités financières et leurs
  prestataires IT. Tests de résilience, gestion du risque tiers, registre des
  prestataires critiques. Pertinent si le client est une banque/assurance/fintech.

## RGPD
- **Minimisation** — ne collecter que le nécessaire.
- **Durée de conservation** — définie par type de donnée, pas indéfinie.
- **Droit à l'effacement** — implémentable concrètement (suppression réelle, y
  compris des embeddings/chunks dérivés dans un RAG).
- **DPA** — accord de traitement signé avec chaque client dont on traite les données.
- Logs : journaliser les accès et erreurs, **jamais** les tokens ni les PII en clair.
