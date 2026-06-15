#!/usr/bin/env python3
"""
audit.py — Audit de sécurité déterministe pour projets IA (FastAPI + Supabase + Vercel + LLM).

Usage:
    python audit.py <chemin_du_projet> [--json]

Ce script collecte des PREUVES mécaniques, il ne raisonne pas. Il complète (ne
remplace pas) la revue manuelle décrite dans SKILL.md (isolation tenant réelle,
concaténation prompt, human-in-the-loop, cohérence RBAC).

Règles appliquées
-----------------
CRITIQUE
  - SQL construit par f-string / .format() / % (injection)
  - Token / session stocké dans localStorage ou sessionStorage (vol via XSS)
  - Secret en clair dans le code (clé OpenAI sk-..., AWS AKIA..., service_role,
    password = "...", api_key = "...")
  - .env suivi par git (présent et non ignoré)

IMPORTANT
  - /docs ou /redoc non désactivés (FastAPI() sans docs_url=None)
  - debug=True
  - CORS allow_origins=["*"] (surtout avec allow_credentials=True)
  - .env absent de .gitignore

INFO
  - Pas de rate limiting détecté (slowapi / limiter) alors qu'un appel LLM existe
  - pip-audit / trufflehog non installés (impossible de vérifier CVE / secrets git)

Si pip-audit et/ou trufflehog sont installés, ils sont lancés et leurs résultats
remontés (CVE dépendances, secrets dans l'historique git).

Code de sortie : 1 si au moins un finding CRITIQUE, sinon 0. Utilisable en CI.
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass, field, asdict
from pathlib import Path

SKIP_DIRS = {".git", "node_modules", ".venv", "venv", "__pycache__", "dist",
             "build", ".next", ".mypy_cache", ".pytest_cache", "site-packages"}
PY_EXT = {".py"}
JS_EXT = {".js", ".jsx", ".ts", ".tsx"}

# --- patterns -------------------------------------------------------------

SQL_CALL = re.compile(r"\b(execute|executemany|text|raw|cursor\.\w+)\s*\(", re.I)
FSTRING_SQL = re.compile(r"""(?ix)
    (?:execute|executemany|text|raw)\s*\(\s*f["']            # f-string in a sql call
    | (?:execute|executemany|text|raw)\s*\(\s*["'][^"']*["']\s*(?:%|\.format)
""")
LOCALSTORAGE_TOKEN = re.compile(
    r"(localStorage|sessionStorage)\s*\.\s*(setItem|getItem)\s*\(\s*['\"]"
    r"[^'\"]*(token|jwt|auth|session|access)", re.I)
SECRET_PATTERNS = [
    ("clé OpenAI", re.compile(r"sk-[A-Za-z0-9]{20,}")),
    ("clé AWS", re.compile(r"AKIA[0-9A-Z]{16}")),
    ("Supabase service_role", re.compile(r"service_role['\"]?\s*[:=]\s*['\"][A-Za-z0-9._-]{20,}")),
    ("mot de passe en clair", re.compile(r"""(?i)\b(password|passwd|pwd)\s*=\s*['"][^'"]{4,}['"]""")),
    ("clé/secret en clair", re.compile(r"""(?i)\b(api[_-]?key|secret|client[_-]?secret)\s*=\s*['"][^'"]{8,}['"]""")),
]
FASTAPI_INIT = re.compile(r"FastAPI\s*\(", re.S)
DOCS_DISABLED = re.compile(r"docs_url\s*=\s*None")
DEBUG_TRUE = re.compile(r"(?i)\bdebug\s*=\s*True\b")
CORS_WILDCARD = re.compile(r"""allow_origins\s*=\s*\[\s*['"]\*['"]\s*\]""")
CORS_CREDENTIALS = re.compile(r"allow_credentials\s*=\s*True")
RATE_LIMIT_HINT = re.compile(r"(slowapi|limiter|RateLimit|@limiter\.limit)", re.I)
LLM_HINT = re.compile(r"(openai|anthropic|azure[._]?openai|chat\.completions|\.messages\.create)", re.I)

SEV_CRIT, SEV_IMP, SEV_INFO = "CRITIQUE", "IMPORTANT", "INFO"


@dataclass
class Finding:
    severity: str
    rule: str
    message: str
    location: str = ""


@dataclass
class Report:
    findings: list = field(default_factory=list)

    def add(self, sev, rule, message, location=""):
        self.findings.append(Finding(sev, rule, message, location))

    @property
    def has_critical(self):
        return any(f.severity == SEV_CRIT for f in self.findings)


def iter_files(root: Path):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            yield Path(dirpath) / name


def read(path: Path):
    try:
        return path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return ""


def loc(path: Path, root: Path, lineno=None):
    rel = path.relative_to(root)
    return f"{rel}:{lineno}" if lineno else str(rel)


def scan_line_matches(text, pattern):
    for i, line in enumerate(text.splitlines(), 1):
        if pattern.search(line):
            yield i, line.strip()


def audit_code(root: Path, rep: Report):
    fastapi_seen = False
    docs_disabled_seen = False
    rate_limit_seen = False
    llm_seen = False

    for path in iter_files(root):
        ext = path.suffix.lower()
        if ext not in PY_EXT and ext not in JS_EXT:
            continue
        text = read(path)
        if not text:
            continue

        # secrets (tous fichiers texte de code)
        for label, pat in SECRET_PATTERNS:
            for lineno, _ in scan_line_matches(text, pat):
                rep.add(SEV_CRIT, "secret-en-clair",
                        f"Secret potentiel ({label}) écrit en dur dans le code.",
                        loc(path, root, lineno))

        if ext in PY_EXT:
            for lineno, _ in scan_line_matches(text, FSTRING_SQL):
                rep.add(SEV_CRIT, "sql-injection",
                        "Requête SQL construite par f-string/format/% — risque d'injection.",
                        loc(path, root, lineno))
            if FASTAPI_INIT.search(text):
                fastapi_seen = True
                if DOCS_DISABLED.search(text):
                    docs_disabled_seen = True
            for lineno, _ in scan_line_matches(text, DEBUG_TRUE):
                rep.add(SEV_IMP, "debug-actif",
                        "debug=True détecté — fuite de stack traces en prod.",
                        loc(path, root, lineno))
            if CORS_WILDCARD.search(text):
                sev = SEV_CRIT if CORS_CREDENTIALS.search(text) else SEV_IMP
                msg = ("CORS allow_origins=['*'] avec allow_credentials=True — "
                       "exfiltration cross-origin." if sev == SEV_CRIT
                       else "CORS allow_origins=['*'] — origines non restreintes.")
                ln = next((n for n, _ in scan_line_matches(text, CORS_WILDCARD)), None)
                rep.add(sev, "cors-wildcard", msg, loc(path, root, ln))
            if RATE_LIMIT_HINT.search(text):
                rate_limit_seen = True
            if LLM_HINT.search(text):
                llm_seen = True

        if ext in JS_EXT:
            for lineno, _ in scan_line_matches(text, LOCALSTORAGE_TOKEN):
                rep.add(SEV_CRIT, "token-localstorage",
                        "Token/session stocké dans localStorage/sessionStorage — "
                        "vol possible via XSS. Préférer un cookie httpOnly.",
                        loc(path, root, lineno))

    if fastapi_seen and not docs_disabled_seen:
        rep.add(SEV_IMP, "docs-exposes",
                "Application FastAPI sans docs_url=None — /docs et /redoc "
                "probablement exposés en prod.")
    if llm_seen and not rate_limit_seen:
        rep.add(SEV_INFO, "rate-limit-absent",
                "Appel LLM détecté mais aucun rate limiting (slowapi/limiter) repéré.")


def audit_env_git(root: Path, rep: Report):
    gitignore = root / ".gitignore"
    ignored = read(gitignore) if gitignore.exists() else ""
    env_ignored = bool(re.search(r"(?m)^\s*\.env\b", ignored)) or ".env" in ignored
    env_files = [p for p in iter_files(root) if p.name == ".env"]

    if env_files and not env_ignored:
        rep.add(SEV_IMP, "env-non-ignore",
                ".env présent mais absent de .gitignore — risque de commit du secret.",
                loc(env_files[0], root))

    # .env réellement suivi par git ?
    if (root / ".git").exists() and shutil.which("git"):
        try:
            out = subprocess.run(["git", "-C", str(root), "ls-files", "*.env", ".env"],
                                 capture_output=True, text=True, timeout=20)
            tracked = [l for l in out.stdout.splitlines() if l.strip()]
            for t in tracked:
                rep.add(SEV_CRIT, "env-suivi-git",
                        f"Fichier d'environnement suivi par git ({t}) — secrets versionnés.",
                        t)
        except Exception:
            pass


def run_external(rep: Report, root: Path):
    if shutil.which("pip-audit"):
        try:
            out = subprocess.run(["pip-audit", "-f", "json"],
                                 capture_output=True, text=True, timeout=120, cwd=str(root))
            data = json.loads(out.stdout or "{}")
            vulns = data.get("dependencies", data) if isinstance(data, dict) else data
            count = 0
            if isinstance(vulns, list):
                count = sum(len(d.get("vulns", [])) for d in vulns if isinstance(d, dict))
            if count:
                rep.add(SEV_CRIT, "cve-dependances",
                        f"pip-audit signale {count} vulnérabilité(s) sur les dépendances.")
        except Exception:
            rep.add(SEV_INFO, "pip-audit-erreur", "pip-audit installé mais exécution échouée.")
    else:
        rep.add(SEV_INFO, "pip-audit-absent",
                "pip-audit non installé — CVE des dépendances non vérifiées (pip install pip-audit).")

    if shutil.which("trufflehog"):
        try:
            out = subprocess.run(["trufflehog", "filesystem", str(root), "--json", "--no-update"],
                                 capture_output=True, text=True, timeout=180)
            hits = [l for l in out.stdout.splitlines() if l.strip().startswith("{")]
            if hits:
                rep.add(SEV_CRIT, "secrets-historique",
                        f"trufflehog a trouvé {len(hits)} secret(s) potentiel(s) dans les fichiers/git.")
        except Exception:
            rep.add(SEV_INFO, "trufflehog-erreur", "trufflehog installé mais exécution échouée.")
    else:
        rep.add(SEV_INFO, "trufflehog-absent",
                "trufflehog non installé — secrets dans l'historique git non vérifiés.")


def print_report(rep: Report, root: Path):
    order = {SEV_CRIT: 0, SEV_IMP: 1, SEV_INFO: 2}
    rep.findings.sort(key=lambda f: order[f.severity])
    counts = {s: sum(1 for f in rep.findings if f.severity == s) for s in (SEV_CRIT, SEV_IMP, SEV_INFO)}

    print(f"\n=== Audit sécurité — {root} ===")
    print(f"CRITIQUE: {counts[SEV_CRIT]}   IMPORTANT: {counts[SEV_IMP]}   INFO: {counts[SEV_INFO]}\n")
    if not rep.findings:
        print("Aucun finding mécanique. Penser à la revue manuelle (RLS, prompts, RBAC).")
        return
    cur = None
    for f in rep.findings:
        if f.severity != cur:
            cur = f.severity
            print(f"--- {cur} ---")
        line = f"  [{f.rule}] {f.message}"
        if f.location:
            line += f"  ({f.location})"
        print(line)
    print("\nRappel : compléter par la revue manuelle (isolation tenant/RLS, "
          "concaténation prompt LLM, human-in-the-loop, cohérence RBAC).")


def main():
    ap = argparse.ArgumentParser(description="Audit sécurité déterministe (FastAPI/Supabase/LLM).")
    ap.add_argument("path", help="Chemin du projet à auditer")
    ap.add_argument("--json", action="store_true", help="Sortie JSON")
    ap.add_argument("--no-external", action="store_true", help="Ne pas lancer pip-audit/trufflehog")
    args = ap.parse_args()

    root = Path(args.path).resolve()
    if not root.exists():
        print(f"Chemin introuvable : {root}", file=sys.stderr)
        sys.exit(2)

    rep = Report()
    audit_code(root, rep)
    audit_env_git(root, rep)
    if not args.no_external:
        run_external(rep, root)

    if args.json:
        print(json.dumps({"root": str(root),
                          "findings": [asdict(f) for f in rep.findings],
                          "has_critical": rep.has_critical}, ensure_ascii=False, indent=2))
    else:
        print_report(rep, root)

    sys.exit(1 if rep.has_critical else 0)


if __name__ == "__main__":
    main()
