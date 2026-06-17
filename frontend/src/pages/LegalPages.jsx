import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

// Pages légales publiques (France). PROJETS à valider juridiquement avant
// publication sur le réseau partenaires UTI. Les [À COMPLÉTER] attendent les
// informations société (SIREN, adresse, etc.).

function LegalLayout({ title, updated, children }) {
  return (
    <div className="min-h-screen app-bg" style={{ color: 'var(--text)' }}>
      <header className="h-14 flex items-center px-6 gap-2.5" style={{ background: 'var(--chrome)', borderBottom: '1px solid var(--border)' }}>
        <img src="/logo.jpeg" alt="UTI Group" className="h-7 w-7 rounded object-cover" />
        <span className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>UTI Group</span>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-10">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs mb-6" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={13} /> Retour
        </Link>
        <h1 className="text-2xl font-bold mb-1">{title}</h1>
        {updated && <p className="text-xs mb-6" style={{ color: 'var(--text-faint)' }}>Dernière mise à jour : {updated}</p>}
        <div className="legal-prose space-y-5 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {children}
        </div>
        <p className="mt-10 text-[11px] italic" style={{ color: 'var(--text-faint)' }}>
          Document de travail — à valider par un conseil juridique avant publication.
        </p>
      </main>
    </div>
  )
}

const H = ({ children }) => <h2 className="text-base font-semibold mt-6 mb-1" style={{ color: 'var(--text)' }}>{children}</h2>

export function MentionsLegales() {
  return (
    <LegalLayout title="Mentions légales" updated="17 juin 2026">
      <H>Éditeur</H>
      <p>
        La plateforme UTI Group est éditée par <strong>UTI Group</strong>,
        [À COMPLÉTER : forme juridique] au capital de [À COMPLÉTER], immatriculée
        au RCS de [À COMPLÉTER] sous le numéro [À COMPLÉTER : SIREN], dont le siège
        social est situé [À COMPLÉTER : adresse].
      </p>
      <p>Directeur de la publication : [À COMPLÉTER].</p>
      <p>Contact : [À COMPLÉTER : e-mail] — Téléphone : [À COMPLÉTER].</p>

      <H>Délégué à la protection des données (DPO)</H>
      <p>Sullyvan BIJON — [À COMPLÉTER : e-mail DPO].</p>

      <H>Hébergement</H>
      <p>
        Frontend : Vercel Inc. — 340 S Lemon Ave #4133, Walnut, CA 91789, USA.<br />
        Backend & base de données : [À COMPLÉTER : OVH / Supabase — raison sociale et adresse].
      </p>

      <H>Propriété intellectuelle</H>
      <p>
        L'ensemble des contenus de la plateforme (marques, logos, textes,
        interfaces) est protégé. Toute reproduction non autorisée est interdite.
      </p>
    </LegalLayout>
  )
}

export function Confidentialite() {
  return (
    <LegalLayout title="Politique de confidentialité & cookies" updated="17 juin 2026">
      <p>
        UTI Group accorde une importance particulière à la protection des données
        personnelles, conformément au RGPD et à la loi Informatique et Libertés.
      </p>

      <H>Responsable de traitement</H>
      <p>UTI Group — [À COMPLÉTER : coordonnées]. DPO : Sullyvan BIJON — [À COMPLÉTER : e-mail].</p>

      <H>Données traitées & finalités</H>
      <ul className="list-disc pl-5 space-y-1">
        <li>Comptes utilisateurs (nom, e-mail, rôle) : gestion des accès.</li>
        <li>CV et données des consultants (identité, compétences, expérience, TJM) :
          mise en relation et évaluation pour des appels d'offres.</li>
        <li>Données d'usage techniques : sécurité et bon fonctionnement.</li>
      </ul>

      <H>Évaluation par un système d'IA (information spécifique)</H>
      <p>
        Les CV des consultants sont évalués et classés par un <strong>système
        d'intelligence artificielle qualifié de « haut risque »</strong> au sens du
        règlement européen sur l'IA (AI Act). Le scoring repose sur des critères
        explicites (compétences, séniorité, adéquation au contexte, TJM) ; la
        <strong> décision finale est prise par un humain</strong>. Toute personne
        concernée peut demander une <strong>révision humaine</strong> de l'évaluation
        la concernant, ou refuser l'évaluation par IA au profit d'un examen manuel.
      </p>

      <H>Base légale</H>
      <p>Consentement et/ou intérêt légitime, selon les traitements. [À COMPLÉTER : préciser par finalité — DPO].</p>

      <H>Destinataires & transferts hors UE</H>
      <p>
        Les données sont accessibles aux équipes habilitées d'UTI Group et, le cas
        échéant, aux partenaires concernés. Le texte des CV est traité, après
        <strong> pseudonymisation</strong> (retrait du nom et des coordonnées), par
        un sous-traitant d'IA situé hors UE (OpenRouter / Anthropic), encadré par
        des garanties contractuelles appropriées.
      </p>

      <H>Durées de conservation</H>
      <p>[À COMPLÉTER : durées par catégorie — voir politique de conservation interne].</p>

      <H>Vos droits</H>
      <p>
        Vous disposez des droits d'accès, de rectification, d'effacement,
        d'opposition, de limitation et de portabilité, ainsi que du droit à une
        intervention humaine sur les décisions assistées par IA. Pour les exercer :
        [À COMPLÉTER : e-mail DPO]. Vous pouvez introduire une réclamation auprès de
        la CNIL (www.cnil.fr).
      </p>

      <H>Cookies & stockage local</H>
      <p>
        La plateforme utilise uniquement des éléments de stockage <strong>strictement
        nécessaires</strong> à son fonctionnement (session d'authentification,
        préférence de thème, état du tutoriel). Aucun cookie publicitaire ou de
        traçage tiers n'est déposé. Ces éléments fonctionnels ne requièrent pas de
        consentement préalable ; ils sont décrits ici à titre d'information.
      </p>
    </LegalLayout>
  )
}

export function CGU() {
  return (
    <LegalLayout title="Conditions générales d'utilisation" updated="17 juin 2026">
      <H>1. Objet</H>
      <p>
        Les présentes CGU régissent l'accès et l'utilisation de la plateforme UTI
        Group, destinée à la mise en relation entre UTI Group, ses partenaires et
        leurs consultants dans le cadre d'appels d'offres.
      </p>

      <H>2. Accès & comptes</H>
      <p>
        L'accès est réservé aux utilisateurs disposant d'un compte créé sur
        invitation. Chaque utilisateur est responsable de la confidentialité de ses
        identifiants et des actions réalisées depuis son compte.
      </p>

      <H>3. Usage du scoring IA</H>
      <p>
        La plateforme fournit un score d'adéquation calculé par un système d'IA, en
        <strong> aide à la décision</strong>. Le score ne constitue pas une décision
        automatisée : la sélection finale relève d'un opérateur humain. Les
        partenaires s'engagent à informer leurs consultants et à recueillir leur
        consentement préalablement à toute soumission de CV.
      </p>

      <H>4. Obligations des utilisateurs</H>
      <p>
        Les utilisateurs s'engagent à ne soumettre que des données exactes, à jour
        et licites, et à respecter la confidentialité des informations auxquelles
        ils accèdent.
      </p>

      <H>5. Responsabilité</H>
      <p>
        UTI Group met en œuvre les moyens raisonnables pour assurer la disponibilité
        et la sécurité de la plateforme, sans garantie d'absence d'interruption ou
        d'erreur. [À COMPLÉTER : clauses de responsabilité — juridique].
      </p>

      <H>6. Données personnelles</H>
      <p>
        Le traitement des données personnelles est décrit dans la{' '}
        <Link to="/legal/confidentialite" style={{ color: 'var(--accent-text)' }}>Politique de confidentialité</Link>.
      </p>

      <H>7. Droit applicable</H>
      <p>Les présentes CGU sont régies par le droit français. [À COMPLÉTER : juridiction compétente].</p>
    </LegalLayout>
  )
}
