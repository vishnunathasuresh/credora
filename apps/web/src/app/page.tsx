import { VerifyForm } from '../components/verify-form';
import { ArrowDownIcon, ArrowUpRightIcon } from '../components/icons';
import { ProofStorageVisualizer } from '../components/proof-storage-visualizer';

const principles = [
  [
    'Issue with proof',
    'Organizations sign once. The registry keeps the record visible and unchanged.',
  ],
  [
    'Carry your work',
    'Credential holders get a portable wallet instead of a file that can disappear.',
  ],
  [
    'Check independently',
    'Recruiters verify from a public link without creating an account or connecting a wallet.',
  ],
];

export default function HomePage() {
  return (
    <main>
      <section className="hero page-width">
        <div className="hero-copy">
          <h1>Credentials that stay yours.</h1>
          <p className="lede">
            Credora gives skills and certifications a durable home—issued by the people who know,
            carried by the people who earned them, and checkable by anyone who needs to know.
          </p>
          <div className="hero-actions">
            <a className="button button-dark" href="/verify">
              Verify a credential <ArrowUpRightIcon />
            </a>
            <a className="text-link" href="#how-it-works">
              See how it works <ArrowDownIcon />
            </a>
          </div>
        </div>
        <div className="hero-proof" aria-label="Illustrative credential flow">
          <div className="proof-topline">
            <span className="signal-dot" /> illustrative / proof shape
          </div>
          <div className="proof-seal">C</div>
          <p className="proof-kicker">Illustrative credential flow</p>
          <h2>Systems thinking</h2>
          <p className="proof-subtitle">Advanced · example record</p>
          <div className="proof-meta">
            <span>Issued by</span>
            <strong>Northstar Institute</strong>
            <span>Proof</span>
            <code>0x8f…91ac</code>
          </div>
          <div className="proof-footer">
            <span>Static fixture · not live data</span>
            <ArrowUpRightIcon />
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

      <ProofStorageVisualizer />

      <section className="principles page-width">
        <div className="section-intro">
          <h2>Trust, without the ceremony.</h2>
        </div>
        <div className="principle-grid">
          {principles.map(([title, body]) => (
            <article className="principle" key={title}>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="verify-band page-width">
        <div>
          <h2>Start with the proof.</h2>
          <p>Paste a credential hash and see what the ledger says.</p>
        </div>
        <VerifyForm />
      </section>
    </main>
  );
}
