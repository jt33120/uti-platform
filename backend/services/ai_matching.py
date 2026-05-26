import json
import asyncio
from typing import Optional
from openai import AsyncOpenAI
from config import settings

client = AsyncOpenAI(
    api_key=settings.openrouter_key,
    base_url="https://openrouter.ai/api/v1"
)

# Claude 3.5 Haiku pricing via OpenRouter
HAIKU_INPUT_COST_PER_MILLION = 0.80  # $0.80 per 1M input tokens
HAIKU_OUTPUT_COST_PER_MILLION = 4.00  # $4.00 per 1M output tokens


def calculate_cost(input_tokens: int, output_tokens: int) -> float:
    """Calculate cost in USD for Claude 3.5 Haiku API usage."""
    input_cost = (input_tokens / 1_000_000) * HAIKU_INPUT_COST_PER_MILLION
    output_cost = (output_tokens / 1_000_000) * HAIKU_OUTPUT_COST_PER_MILLION
    return input_cost + output_cost


SCORING_SYSTEM_PROMPT = """Tu es un expert en recrutement IT et consulting, spécialisé dans l'évaluation de profils techniques.

Ton rôle : analyser des CVs de consultants et les scorer par rapport à un Appel d'Offres (AO).

Tu dois retourner UNIQUEMENT un JSON valide, sans markdown, sans texte avant ou après.

Critères de scoring (total 100 points) :
- competences_techniques (40 pts max) : match entre les compétences requises et celles du consultant
- seniorite (20 pts max) : niveau d'expérience et années dans le domaine
- contexte_domaine (20 pts max) : familiarité avec le secteur/contexte métier de l'AO
- compatibilite_tjm (20 pts max) : TJM du consultant vs budget de l'AO (si fournis)

Format de réponse requis :
{
  "consultants": [
    {
      "consultant_id": "...",
      "score_total": 87,
      "breakdown": {
        "competences_techniques": 36,
        "seniorite": 18,
        "contexte_domaine": 16,
        "compatibilite_tjm": 17
      },
      "points_forts": ["point 1", "point 2", "point 3"],
      "points_faibles": ["point 1"],
      "resume_matching": "Explication concise en 2-3 phrases de pourquoi ce profil correspond (ou pas) à l'AO.",
      "recommandation": "FORT" | "MOYEN" | "FAIBLE"
    }
  ]
}
"""


def build_matching_prompt(ao: dict, consultants: list[dict]) -> str:
    """Build the user prompt for matching."""
    
    # Format AO
    ao_section = f"""=== APPEL D'OFFRES ===
Titre : {ao.get('title', 'N/A')}
Description : {ao.get('description', 'N/A')}
Compétences requises : {ao.get('skills_required', 'N/A')}
Budget / TJM max : {ao.get('budget_max', 'Non précisé')} €/jour
Localisation : {ao.get('location', 'Non précisée')}
Durée : {ao.get('duration', 'Non précisée')}
Contexte supplémentaire : {ao.get('context', '')}
"""

    # Format each consultant
    consultants_section = "\n\n".join([
        f"""=== CONSULTANT {i+1} (ID: {c['id']}) ===
Nom : {c.get('name', 'N/A')}
TJM demandé : {c.get('tjm', 'Non précisé')} €/jour
Compétences déclarées : {c.get('skills', 'N/A')}
Années d'expérience : {c.get('experience_years', 'Non précisé')}

CONTENU DU CV :
{c.get('cv_text', 'CV non disponible')[:3000]}
{"[CV tronqué pour la longueur]" if len(c.get('cv_text', '')) > 3000 else ""}
"""
        for i, c in enumerate(consultants)
    ])

    return f"""{ao_section}

{consultants_section}

---
Analyse chaque consultant par rapport à cet AO et retourne le JSON de scoring.
Les IDs des consultants dans ta réponse doivent correspondre exactement aux IDs fournis.
Score les {len(consultants)} consultant(s) fourni(s).
"""


async def score_consultants(ao: dict, consultants: list[dict]) -> tuple[list[dict], float]:
    """
    Core AI matching function.
    Uses Claude 3.5 Haiku with structured JSON output for reliable, explainable scoring.
    Returns (scored_results, cost_usd).

    Strategy:
    1. Send AO + all CVs texts in a single prompt
    2. Claude 3.5 Haiku scores each consultant with breakdown + explanation
    3. Sort by total score, return top results
    """
    if not consultants:
        return [], 0.0

    prompt = build_matching_prompt(ao, consultants)

    try:
        response = await client.chat.completions.create(
            model="anthropic/claude-3.5-haiku",
            messages=[
                {"role": "system", "content": SCORING_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.2,  # Low temp for consistent scoring
            max_tokens=4000,
        )

        content = response.choices[0].message.content
        result = json.loads(content)
        scored = result.get("consultants", [])

        # Calculate cost
        usage = response.usage
        cost = calculate_cost(usage.prompt_tokens, usage.completion_tokens)

        # Sort by total score descending
        scored.sort(key=lambda x: x.get("score_total", 0), reverse=True)

        # Enrich with consultant metadata
        consultant_map = {str(c["id"]): c for c in consultants}
        for item in scored:
            cid = str(item.get("consultant_id", ""))
            if cid in consultant_map:
                c = consultant_map[cid]
                item["consultant_name"] = c.get("name", "Inconnu")
                item["consultant_tjm"] = c.get("tjm")
                item["consultant_skills"] = c.get("skills", "")

        return scored, cost

    except json.JSONDecodeError as e:
        raise ValueError(f"GPT response parsing error: {e}")
    except Exception as e:
        raise RuntimeError(f"OpenAI API error: {e}")


async def score_consultants_batch(ao: dict, consultants: list[dict], batch_size: int = 5) -> tuple[list[dict], float]:
    """
    Handle large number of consultants by batching.
    Haiku context window allows ~10 CVs at once safely.
    For more, we batch and merge results.
    Returns (scored_results, total_cost_usd).
    """
    if len(consultants) <= batch_size:
        return await score_consultants(ao, consultants)

    # Process in batches
    batches = [consultants[i:i+batch_size] for i in range(0, len(consultants), batch_size)]
    all_results = []
    total_cost = 0.0

    tasks = [score_consultants(ao, batch) for batch in batches]
    batch_results = await asyncio.gather(*tasks)

    for results, cost in batch_results:
        all_results.extend(results)
        total_cost += cost

    # Re-sort globally after merging
    all_results.sort(key=lambda x: x.get("score_total", 0), reverse=True)

    return all_results, total_cost
