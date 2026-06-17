import { Link } from 'react-router-dom'

// Footer discret, présent sous le contenu principal. Liens légaux requis pour
// publier la plateforme (mentions, confidentialité/cookies, CGU).
export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer
      className="mt-10 pt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px]"
      style={{ borderTop: '1px solid var(--border)', color: 'var(--text-faint)' }}
    >
      <span>© {year} UTI Group</span>
      <span aria-hidden>·</span>
      <Link to="/legal/mentions" className="hover:underline" style={{ color: 'var(--text-faint)' }}>Mentions légales</Link>
      <span aria-hidden>·</span>
      <Link to="/legal/confidentialite" className="hover:underline" style={{ color: 'var(--text-faint)' }}>Confidentialité & cookies</Link>
      <span aria-hidden>·</span>
      <Link to="/legal/cgu" className="hover:underline" style={{ color: 'var(--text-faint)' }}>CGU</Link>
    </footer>
  )
}
