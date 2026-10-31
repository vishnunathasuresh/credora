import { ArrowUpRightIcon, CheckIcon } from './icons';
import { Button } from './ui/button';
import { EditorialProfileIdentity } from './profile/editorial-profile-identity';

const illustrativeCredential = {
  title: 'Product Design Foundations',
  issuerName: 'Northstar Learning',
  issueDate: '2025-06-01',
  recipientName: 'Avery Chen',
  recipientHandle: 'averychen',
};

export function HomePage() {
  return (
    <main className="home-page">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-copy">
          <h1 id="home-title">
            Your work,
            <br />
            with proof.
          </h1>
          <p>
            Build a professional profile around your story and the achievements you’ve earned.
            Visitors can check credential proof without signing in or connecting a wallet.
          </p>
          <div className="home-actions">
            <Button asChild className="home-primary-action">
              <a href="/join">
                Build your profile <ArrowUpRightIcon />
              </a>
            </Button>
            <a className="home-text-action" href="/verify">
              Verify a credential <ArrowUpRightIcon />
            </a>
          </div>
          <p className="home-verify-link">
            <span>Profiles start private.</span> Add a wallet only when you need your credentials.
          </p>
        </div>

        <div className="home-artifact" aria-label="Illustrative profile and credential composition">
          <span className="home-artifact-boundary">Illustrative profile and credential</span>
          <div className="home-preview-layout home-identity-scene">
            <article className="home-profile-preview">
              <EditorialProfileIdentity
                name={illustrativeCredential.recipientName}
                handle={illustrativeCredential.recipientHandle}
                role="Product designer"
                initials="AC"
              />
              <div className="preview-divider" />
              <span className="preview-label">Featured achievement</span>
              <div className="preview-project">
                {illustrativeCredential.title}
                <small>{illustrativeCredential.issuerName} · Issuer-backed credential</small>
              </div>
            </article>
            <article className="home-demo-panel home-demo-credential">
              <span className="preview-label">Illustrative credential</span>
              <h2>{illustrativeCredential.title}</h2>
              <p>Issued by {illustrativeCredential.issuerName}</p>
              <span className="home-demo-note">Issuer-backed achievement</span>
            </article>
            <article className="home-demo-panel home-demo-proof">
              <span className="preview-label">Independent verification</span>
              <h2>Proof you can check.</h2>
              <p>Explore the public record without signing in or connecting a wallet.</p>
              <a href="/verify">
                Verify a credential <ArrowUpRightIcon size={14} />
              </a>
            </article>
          </div>
        </div>
      </section>

      <section className="home-section home-profile-section" aria-labelledby="profile-story-title">
        <div className="home-section-inner">
          <div className="home-profile-intro">
            <h2 id="profile-story-title">Your story, your evidence.</h2>
            <p className="home-section-intro">
              Write about your work in your own words and choose which credentials to feature. Your
              profile starts private; publish it when you’re ready.
            </p>
          </div>
          <div className="home-profile-composition">
            <div className="home-profile-story">
              <h3>A profile that starts with you.</h3>
              <p>
                Add a headline, bio, links, projects, experience and education. Your profile works
                before you connect a wallet.
              </p>
              <Button asChild variant="outline">
                <a href="/join">
                  Create a profile <ArrowUpRightIcon />
                </a>
              </Button>
            </div>
            <article
              className="home-profile-sample"
              aria-label="How profile information is presented"
            >
              <div className="home-evidence-row">
                <span className="home-evidence-index">A</span>
                <div>
                  <h3>Your profile</h3>
                  <p>Self-written details you choose to publish</p>
                </div>
                <span className="home-evidence-kind">Your words</span>
              </div>
              <div className="home-evidence-row">
                <span className="home-evidence-index">B</span>
                <div>
                  <h3>Your credentials</h3>
                  <p>Achievements issued by organizations and linked to public proof</p>
                </div>
                <span className="home-evidence-kind">Their record</span>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section
        className="home-section home-credential-section"
        aria-labelledby="credential-story-title"
      >
        <div className="home-section-inner home-proof-inner">
          <div className="home-proof-copy">
            <h2 id="credential-story-title">Proof travels with each credential.</h2>
            <p className="home-section-intro">
              The registry records the issuer and credential proof. Public metadata describes the
              achievement. A verifier checks both independently.
            </p>
            <div className="home-credential-points">
              <div>
                <span className="home-point-mark">
                  <CheckIcon size={15} />
                </span>
                Issuer and achievement remain in focus
              </div>
              <div>
                <span className="home-point-mark">
                  <CheckIcon size={15} />
                </span>
                Proof details are available when needed
              </div>
              <div>
                <span className="home-point-mark">
                  <CheckIcon size={15} />
                </span>
                Visitors can verify without an account
              </div>
            </div>
          </div>
          <div className="home-proof-path" aria-label="Credential verification path">
            <div className="home-proof-step">
              <span>Achievement</span>
              <strong>{illustrativeCredential.title}</strong>
            </div>
            <span className="home-proof-connector" aria-hidden="true">
              →
            </span>
            <div className="home-proof-step">
              <span>Issuer</span>
              <strong>{illustrativeCredential.issuerName}</strong>
            </div>
            <span className="home-proof-connector" aria-hidden="true">
              →
            </span>
            <div className="home-proof-step home-proof-result">
              <span>Public record</span>
              <strong>Check the proof</strong>
              <small>Illustrative flow</small>
            </div>
          </div>
        </div>
      </section>

      <section className="home-section home-sharing-section" aria-labelledby="sharing-title">
        <div className="home-section-inner">
          <h2 id="sharing-title">Choose what leaves your hands.</h2>
          <p className="home-section-intro">
            Publish selected profile details, share a public credential link, or create a temporary
            collection for a specific conversation.
          </p>
          <div className="home-share-composition">
            <article className="home-share-panel">
              <div className="home-share-copy">
                <h3>A public profile, when you choose.</h3>
                <p>
                  Visitors can see the profile details you’ve added and the credentials you chose to
                  feature. You can unpublish later, but copies and public proof records may remain
                  elsewhere.
                </p>
              </div>
              <div className="home-share-link">
                <span>/u/your-handle</span>
                <span>Public profile path</span>
              </div>
            </article>
            <article className="home-share-panel home-share-secondary">
              <div className="home-share-copy">
                <h3>A temporary credential collection.</h3>
                <p>
                  Choose credentials for a time-limited share link. This stays separate from your
                  public profile.
                </p>
              </div>
              <Button asChild variant="outline">
                <a href="/credentials">
                  Explore credentials <ArrowUpRightIcon />
                </a>
              </Button>
            </article>
          </div>
        </div>
      </section>

      <section className="home-closing" aria-labelledby="closing-title">
        <div className="home-closing-inner">
          <div>
            <h2 id="closing-title">Start with what you’ve done.</h2>
            <p>Build your profile, or check a credential someone has shared with you.</p>
          </div>
          <div className="home-actions home-closing-actions">
            <Button asChild>
              <a href="/join">
                Build your profile <ArrowUpRightIcon />
              </a>
            </Button>
            <a href="/verify">Verify a credential</a>
          </div>
        </div>
      </section>
    </main>
  );
}
