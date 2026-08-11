import { VerifyForm } from '../components/verify-form';

const principles = [
  [
    '01',
    'Issue with proof',
    'Organizations sign once. The registry keeps the record visible and unchanged.',
  ],
  [
    '02',
    'Carry your work',
    'Credential holders get a portable wallet instead of a file that can disappear.',
  ],
  [
    '03',
    'Check independently',
    'Recruiters verify from a public link without creating an account or connecting a wallet.',
  ],
];

export default function HomePage() {
  return (
    <main>
      <section className="hero page-width">
        <div className="hero-copy">
          <p className="eyebrow">A quieter kind of trust</p>
          <h1>Credentials that stay yours.</h1>
          <p className="lede">
            Credora gives skills and certifications a durable home—issued by the people who know,
            carried by the people who earned them, and checkable by anyone who needs to know.
          </p>
          <div className="hero-actions">
            <a className="button button-dark" href="/verify">
              Verify a credential <span>↗</span>
            </a>
            <a className="text-link" href="#how-it-works">
              See how it works <span>↓</span>
            </a>
          </div>
        </div>
        <div className="hero-proof" aria-label="Example verified credential">
          <div className="proof-topline">
            <span className="signal-dot" /> registry / record 0001
          </div>
          <div className="proof-seal">C</div>
          <p className="proof-kicker">Credential verified</p>
          <h2>Systems thinking</h2>
          <p className="proof-subtitle">Advanced · issued 11 Aug 2026</p>
          <div className="proof-meta">
            <span>Issued by</span>
            <strong>Northstar Institute</strong>
            <span>Proof</span>
            <code>0x8f…91ac</code>
          </div>
          <div className="proof-footer">
            <span>Immutable record</span>
            <span>↗</span>
          </div>
        </div>
      </section>

      <section className="ticker" aria-label="Protocol properties">
        <div className="ticker-inner">
          <span>OPEN PROTOCOL</span>
          <span>·</span>
          <span>SELF-HOSTABLE</span>
          <span>·</span>
          <span>NO WALLET REQUIRED TO VERIFY</span>
          <span>·</span>
          <span>OPEN PROTOCOL</span>
        </div>
      </section>

      <section className="principles page-width" id="how-it-works">
        <div className="section-intro">
          <p className="eyebrow">The Credora way</p>
          <h2>Trust, without the ceremony.</h2>
        </div>
        <div className="principle-grid">
          {principles.map(([number, title, body]) => (
            <article className="principle" key={number}>
              <span className="principle-number">{number}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="verify-band page-width">
        <div>
          <p className="eyebrow">Already have a reference?</p>
          <h2>Start with the proof.</h2>
          <p>Paste a credential hash and see what the ledger says.</p>
        </div>
        <VerifyForm />
      </section>
    </main>
  );
}
