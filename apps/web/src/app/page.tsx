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
          <h1>Proof that travels with the person who earned it.</h1>
          <p className="lede">
            Issue skills and certifications with a durable public record. Holders carry the result,
            and anyone can verify it without an account or a wallet.
          </p>
          <div className="hero-actions">
            <a className="button button-dark" href="/verify">
              Verify a credential <ArrowUpRightIcon />
            </a>
            <a className="button button-outline" href="#how-it-works">
              See how it works <ArrowDownIcon />
            </a>
          </div>
          <div className="hero-note">
            <span className="hero-note-mark" aria-hidden="true">
              <span />
            </span>
            No wallet required for read-only verification
          </div>
        </div>
        <div className="hero-record-wrap">
          <div className="hero-record-grid" aria-hidden="true" />
          <div className="hero-proof" aria-label="Illustrative credential flow">
            <div className="record-header">
              <div>
                <span className="record-kicker">Illustrative credential flow</span>
                <span className="record-caption">Static fixture · not live data</span>
              </div>
              <span className="record-state">
                <span className="record-state-dot" />
                Public record
              </span>
            </div>
            <div className="record-rule" />
            <div className="record-seal">C</div>
            <p className="proof-kicker">Credential record</p>
            <h2>Systems thinking</h2>
            <p className="proof-subtitle">Advanced · example credential</p>
            <div className="proof-meta">
              <span>Issued by</span>
              <strong>Northstar Institute</strong>
              <span>Credential hash</span>
              <code>0x8f…91ac</code>
              <span>Metadata</span>
              <code>ipfs://bafy…8p4m</code>
            </div>
            <div className="proof-footer">
              <span>Illustrative only</span>
              <span className="record-check">
                <span /> Chain + metadata
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="protocol-strip page-width" aria-label="Protocol properties">
        <div className="protocol-strip-item">
          <span className="protocol-strip-icon">01</span>
          <span>
            <strong>Public by design</strong>
            <small>Proof lives beyond one database</small>
          </span>
        </div>
        <div className="protocol-strip-item">
          <span className="protocol-strip-icon">02</span>
          <span>
            <strong>Portable by default</strong>
            <small>Credentials move with their holder</small>
          </span>
        </div>
        <div className="protocol-strip-item">
          <span className="protocol-strip-icon">03</span>
          <span>
            <strong>Simple to verify</strong>
            <small>No account or wallet required</small>
          </span>
        </div>
      </section>

      <ProofStorageVisualizer />

      <section className="principles page-width">
        <div className="section-intro">
          <h2>Trust, without the ceremony.</h2>
          <p>Good infrastructure should make the important parts easier to inspect.</p>
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
