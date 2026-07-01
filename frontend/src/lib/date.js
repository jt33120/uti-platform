// Formatage de dates au format français, robuste à l'off-by-one UTC.
// Les dates « date seule » (YYYY-MM-DD) sont interprétées en local pour ne pas
// décaler d'un jour selon le fuseau.

export const parseDateLocal = (iso) => {
  if (!iso) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso))
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(iso)
}

// « 15 juillet 2026 »
export const formatDateFR = (iso) => {
  const d = parseDateLocal(iso)
  if (!d || isNaN(d)) return ''
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(d)
}

// « 15/07/2026 »
export const formatDateShortFR = (iso) => {
  const d = parseDateLocal(iso)
  if (!d || isNaN(d)) return ''
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
}
