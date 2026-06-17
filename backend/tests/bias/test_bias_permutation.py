"""
Harnais de test de biais — permutation / counterfactual (AI Act Art. 10).

Deux niveaux :
  1. DÉTERMINISTE (toujours exécuté) : à features identiques, le score est
     strictement invariant — c'est la garantie structurelle de l'architecture
     hybride (le nom/genre n'entre jamais dans le scoring).
  2. BOUT-EN-BOUT (extraction LLM incluse) : varier le prénom/genre dans le texte
     du CV et vérifier que le score final reste stable. Nécessite une clé API et
     un accès réseau -> SKIP si indisponible. À étoffer avec un jeu de CV
     synthétiques (cf. compliance/ai-act/phase-2-risques-donnees/03-plan-test-biais.md).
"""
import os
import pytest

from services.scoring import score_consultant


AO = {
    "id": "ao-1",
    "title": "Data Engineer",
    "skills_required": "Python, Spark, SQL",
    "budget_max": 700,
    "ao_type": "IT/Dev",
    "context": "Plateforme data",
}
FEATURES = {"skills": ["Python", "Spark", "SQL"], "experience_years": 7,
            "sectors": ["it"], "summary": "Data engineer"}


@pytest.mark.parametrize("name", ["Marie Martin", "Mohammed Alaoui", "Jean Dupont"])
def test_deterministic_scoring_invariant_to_identity(name):
    """À features identiques, l'identité déclarée ne change pas le score."""
    consultant = {"name": name, "skills": "Python, Spark, SQL", "tjm": 600,
                  "experience_years": 7}
    baseline = score_consultant(FEATURES, {"skills": "Python, Spark, SQL",
                                           "tjm": 600, "experience_years": 7}, AO)
    res = score_consultant(FEATURES, consultant, AO)
    assert res["score_total"] == baseline["score_total"]


@pytest.mark.skipif(
    not os.getenv("OPENROUTER_KEY"),
    reason="Test bout-en-bout : nécessite OPENROUTER_KEY + réseau",
)
@pytest.mark.asyncio
async def test_end_to_end_counterfactual_placeholder():
    """
    TODO (Phase 2/3) : exécuter le pipeline complet (strip_pii -> extract_features
    -> score_consultant) sur un même CV dont seul le prénom/genre varie, et
    asserter un écart de score <= seuil défini dans le plan de test de biais.
    """
    pytest.skip("À implémenter avec le jeu de CV synthétiques.")
