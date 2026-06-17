"""
Étape 2 du pipeline — SCORING DÉTERMINISTE (aucune IA).

Conformité AI Act : le score est calculé ici par une formule **explicite,
versionnée et reproductible** (Art. 13 transparence, Art. 15 reproductibilité),
sur des **features justifiables** (Art. 10 — pas de texte brut porteur de biais).

Grille (total 100) :
  competences_techniques : 40 — recouvrement compétences requises ∩ candidat
  seniorite              : 20 — années d'expérience vs cible
  contexte_domaine       : 20 — adéquation secteur/contexte de l'AO
  compatibilite_tjm      : 20 — TJM consultant vs budget de l'AO

⚠️ Les seuils ci-dessous sont des VALEURS PAR DÉFAUT, à valider par le métier
(cf. compliance/ai-act/phase-3-technique/02-spec-architecture-hybride.md).
Toute modification doit incrémenter GRID_VERSION (Art. 17 — gestion des
modifications) et déclencher les tests de biais.
"""
from __future__ import annotations
import re
import unicodedata
from typing import Optional

GRID_VERSION = "1.0.0"

# Poids de la grille (somme = 100)
W_COMPETENCES = 40
W_SENIORITE = 20
W_CONTEXTE = 20
W_TJM = 20

SENIORITY_FULL_YEARS = 8   # années d'XP pour le score séniorité maximal
RECO_FORT_MIN = 75         # score total >= FORT
RECO_MOYEN_MIN = 50        # score total >= MOYEN
NEUTRAL_RATIO = 0.5        # ratio neutre appliqué quand une donnée manque
STRONG_RATIO = 0.75        # ratio d'un critère => point fort
WEAK_RATIO = 0.40          # ratio d'un critère => point faible

# Configuration par défaut de la grille. Ces valeurs sont pilotables depuis un
# compte admin (table scoring_config + page « Paramètres scoring ») ; toute
# valeur fournie via `config` surcharge le défaut correspondant. Garder la
# traçabilité : un changement de config est journalisé (Art. 12).
DEFAULTS = {
    "w_competences": W_COMPETENCES,
    "w_seniorite": W_SENIORITE,
    "w_contexte": W_CONTEXTE,
    "w_tjm": W_TJM,
    "seniority_full_years": SENIORITY_FULL_YEARS,
    "reco_fort_min": RECO_FORT_MIN,
    "reco_moyen_min": RECO_MOYEN_MIN,
}

_SPLIT = re.compile(r"[,;/|\n]+")
# Mots vides FR/EN les plus courants, écartés des signaux de contexte.
_STOPWORDS = {
    "le", "la", "les", "un", "une", "des", "de", "du", "et", "ou", "en", "au",
    "aux", "pour", "avec", "sur", "dans", "par", "sans", "the", "and", "for",
    "with", "of", "to", "in", "on", "a", "an", "ans", "an",
}


def _norm(s: str) -> str:
    """Minuscule, sans accents, espaces normalisés."""
    s = unicodedata.normalize("NFKD", str(s))
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", s).strip().lower()


def _tokens(value: Optional[str]) -> list[str]:
    """Découpe une chaîne (compétences/contexte) en tokens normalisés utiles."""
    if not value:
        return []
    parts = _SPLIT.split(str(value))
    out: list[str] = []
    for p in parts:
        t = _norm(p)
        if len(t) > 2 and t not in _STOPWORDS:
            out.append(t)
    return out


def _match(needle: str, haystack: set[str]) -> bool:
    """Correspondance lâche : égalité ou inclusion mutuelle (ex. 'react' ⊂ 'react.js')."""
    return any(needle == h or needle in h or h in needle for h in haystack)


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def _reco(total: int, fort_min: int, moyen_min: int) -> str:
    if total >= fort_min:
        return "FORT"
    if total >= moyen_min:
        return "MOYEN"
    return "FAIBLE"


def score_consultant(features: dict, consultant: dict, ao: dict, config: dict | None = None) -> dict:
    """
    Calcule le score d'un consultant pour un AO, de façon 100 % déterministe.

    `features`   : sortie de l'extraction LLM (peut être vide -> fallback déclaré).
    `consultant` : données déclarées (skills, tjm, experience_years).
    `ao`         : appel d'offres (skills_required, budget_max, ao_type, context...).
    `config`     : surcharge optionnelle de la grille (poids/seuils), pilotée par
                   l'admin. Les clés absentes retombent sur DEFAULTS.

    Retourne un dict compatible avec la table `matchings` :
    score_total, breakdown, points_forts, points_faibles, resume_matching, recommandation.
    """
    features = features or {}
    cfg = {**DEFAULTS, **{k: v for k, v in (config or {}).items() if v is not None}}
    w_comp = cfg["w_competences"]
    w_sen = cfg["w_seniorite"]
    w_ctx = cfg["w_contexte"]
    w_tjm = cfg["w_tjm"]
    seniority_full = cfg["seniority_full_years"] or SENIORITY_FULL_YEARS

    # ── Compétences (40) ───────────────────────────────────────────
    required = _tokens(ao.get("skills_required"))
    candidate_skills = {_norm(s) for s in features.get("skills", [])}
    candidate_skills |= set(_tokens(consultant.get("skills")))
    if not required:
        comp_ratio = NEUTRAL_RATIO
    elif not candidate_skills:
        comp_ratio = 0.0
    else:
        matched = [r for r in required if _match(r, candidate_skills)]
        comp_ratio = len(matched) / len(required)
    comp_score = round(w_comp * _clamp01(comp_ratio))

    # ── Séniorité (20) ─────────────────────────────────────────────
    years = features.get("experience_years")
    if years is None:
        years = consultant.get("experience_years")
    if years is None:
        sen_ratio = NEUTRAL_RATIO
    else:
        sen_ratio = _clamp01(max(years, 0) / seniority_full)
    sen_score = round(w_sen * sen_ratio)

    # ── Contexte / secteur (20) ────────────────────────────────────
    ctx_signals = (
        _tokens(ao.get("ao_type"))
        + _tokens(ao.get("context"))
        + _tokens(ao.get("title"))
    )
    cand_ctx = {_norm(s) for s in features.get("sectors", [])}
    cand_ctx |= set(_tokens(features.get("summary")))
    cand_ctx |= set(_tokens(consultant.get("skills")))
    if not ctx_signals:
        ctx_ratio = NEUTRAL_RATIO
    else:
        hits = [t for t in ctx_signals if _match(t, cand_ctx)]
        # Lâche : retrouver la moitié des signaux suffit pour le score plein.
        ctx_ratio = _clamp01(len(hits) / len(ctx_signals) * 2)
    ctx_score = round(w_ctx * ctx_ratio)

    # ── Compatibilité TJM (20) ─────────────────────────────────────
    budget = ao.get("budget_max")
    tjm = consultant.get("tjm")
    if not budget or not tjm:
        tjm_ratio = NEUTRAL_RATIO
    elif tjm <= budget:
        tjm_ratio = 1.0
    else:
        tjm_ratio = _clamp01(budget / tjm)
    tjm_score = round(w_tjm * tjm_ratio)

    total = comp_score + sen_score + ctx_score + tjm_score

    breakdown = {
        "competences_techniques": comp_score,
        "seniorite": sen_score,
        "contexte_domaine": ctx_score,
        "compatibilite_tjm": tjm_score,
    }

    # ── Points forts / faibles dérivés des ratios (explicabilité) ──
    criteria = [
        ("compétences techniques", comp_ratio),
        ("séniorité", sen_ratio),
        ("adéquation au contexte", ctx_ratio),
        ("compatibilité TJM", tjm_ratio),
    ]
    points_forts = [f"Bon niveau : {label}" for label, r in criteria if r >= STRONG_RATIO]
    points_faibles = [f"À vérifier : {label}" for label, r in criteria if r <= WEAK_RATIO]

    resume = (
        f"Score {total}/100 — compétences {comp_score}/{w_comp}, "
        f"séniorité {sen_score}/{w_sen}, contexte {ctx_score}/{w_ctx}, "
        f"TJM {tjm_score}/{w_tjm}. Évaluation déterministe (grille v{GRID_VERSION})."
    )

    return {
        "score_total": total,
        "breakdown": breakdown,
        "points_forts": points_forts,
        "points_faibles": points_faibles,
        "resume_matching": resume,
        "recommandation": _reco(total, cfg["reco_fort_min"], cfg["reco_moyen_min"]),
    }
