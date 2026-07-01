// Détection de doublons « à la faute de frappe près » (Groupama ↔ Groupma).
// Normalise (minuscules, sans accents/ponctuation/espaces) puis compare via le
// coefficient de Dice sur les bigrammes. Léger, sans dépendance, suffisant pour
// une liste de clients de taille modeste.

export function normalizeName(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // accents
    .replace(/[^a-z0-9]/g, '')       // ponctuation + espaces
    .trim()
}

function bigrams(s) {
  const set = new Map()
  for (let i = 0; i < s.length - 1; i++) {
    const g = s.slice(i, i + 2)
    set.set(g, (set.get(g) || 0) + 1)
  }
  return set
}

// Coefficient de Dice ∈ [0,1] ; 1 = identique.
export function diceCoefficient(a, b) {
  const na = normalizeName(a)
  const nb = normalizeName(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  if (na.length < 2 || nb.length < 2) return na === nb ? 1 : 0
  const ba = bigrams(na)
  const bb = bigrams(nb)
  let inter = 0
  for (const [g, count] of ba) {
    if (bb.has(g)) inter += Math.min(count, bb.get(g))
  }
  const total = (na.length - 1) + (nb.length - 1)
  return (2 * inter) / total
}

// Renvoie les clients dont le nom ressemble à `name` (hors `excludeId`),
// triés du plus ressemblant au moins ressemblant.
// Rattrape aussi les inclusions (sous-chaîne) pour ne rien manquer.
export function findSimilarClients(name, clients, { excludeId = null, threshold = 0.5 } = {}) {
  const target = normalizeName(name)
  if (target.length < 2) return []
  return clients
    .filter(c => c.id !== excludeId)
    .map(c => {
      const norm = normalizeName(c.name)
      const substring = norm.includes(target) || target.includes(norm)
      const score = substring ? Math.max(0.9, diceCoefficient(name, c.name)) : diceCoefficient(name, c.name)
      return { client: c, score }
    })
    .filter(x => x.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .map(x => x.client)
}
