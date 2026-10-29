import { ArrowUpRightIcon, CheckIcon } from './icons';
import { LanyardPreview } from './credential-lanyard';
import { Button } from './ui/button';

export function HomePage() {
  return (
    <main className="home-page">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-copy">
          <h1 id="home-title">
            Let your work
            <br />
            speak for you.
          </h1>
          <p>
            A professional profile for your story and the achievements you’ve earned — with
            credentials anyone can verify.
          </p>
          <div className="home-actions">
            <Button asChild className="home-primary-action">
              <a href="/profile">
                Build your profile <ArrowUpRightIcon />
              </a>
            </Button>
            <a className="home-text-action" href="/wallet">
              Explore credentials <ArrowUpRightIcon />
            </a>
          </div>
          <a className="home-verify-link" href="/verify">
            Already have a credential?{' '}
            <span>
              Verify it here <ArrowUpRightIcon />
            </span>
          </a>
        </div>

        <div className="home-artifact" aria-label="Illustrative profile and credential preview">
          <span className="home-artifact-boundary">Illustrative preview</span>
          <div className="home-preview-layout">
            <article className="home-profile-preview">
              <div className="preview-avatar" aria-hidden="true">
                AC
              </div>
              <h2 className="preview-name">Avery Chen</h2>
              <p className="preview-handle">@averychen</p>
              <p className="preview-role">
                Product designer · Building useful things with thoughtful teams
              </p>
              <div className="preview-divider" />
              <span className="preview-label">Featured achievement</span>
              <div className="preview-project">
                Product Design Foundations
                <small>Northstar Learning · Issuer-backed credential</small>
              </div>
            </article>
            <article
              className="preview-credential"
              aria-label="Illustrative credential, not a real record"
            >
              <div className="preview-org">
                <span className="preview-org-mark">N</span>
                <span>NORTHSTAR LEARNING</span>
              </div>
              <h3>
                Product Design
                <br />
                Foundations
              </h3>
              <p>Presented to Avery Chen</p>
              <div className="preview-credential-rule" />
              <span className="preview-proof-label">
                <span className="preview-proof-dot" /> Verifiable credential
              </span>
            </article>
          </div>
          <p className="home-artifact-caption">
            A profile and the achievement behind it, together.
          </p>
        </div>
      </section>

      <section className="home-section home-profile-section" aria-labelledby="profile-story-title">
        <div className="home-section-inner">
          <h2 id="profile-story-title">One link for your professional story.</h2>
          <p className="home-section-intro">
            Bring your name, headline, bio, links and issuer-backed achievements into a profile that
            feels like you.
          </p>
          <div className="home-profile-composition">
            <div className="home-profile-story">
              <h3>Your name, your point of view.</h3>
              <p>
                Tell your story in your own words. Choose what appears on your public profile, and
                keep everything else private until you’re ready to share.
              </p>
              <Button asChild variant="outline">
                <a href="/profile">
                  Create a profile <ArrowUpRightIcon />
                </a>
              </Button>
            </div>
            <article
              className="home-profile-sample"
              aria-label="Illustrative public profile preview"
            >
              <div className="profile-sample-head">
                <div className="preview-avatar" aria-hidden="true">
                  AC
                </div>
                <div>
                  <h3>Avery Chen</h3>
                  <p>@averychen · Product designer</p>
                </div>
              </div>
              <p className="profile-sample-body">
                I turn complex ideas into clear, useful products. Currently exploring the
                intersection of design systems and developer experience.
              </p>
              <div className="preview-divider" />
              <span className="preview-label">Featured achievement</span>
              <div className="preview-project">
                Product Design Foundations
                <small>Northstar Learning · Issuer-backed credential</small>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section
        className="home-section home-credential-section"
        aria-labelledby="credential-story-title"
      >
        <div className="home-section-inner">
          <h2 id="credential-story-title">An achievement with its proof attached.</h2>
          <p className="home-section-intro">
            Credentials stay connected to the organization that issued them and the evidence
            visitors can check for themselves.
          </p>
          <div className="home-credential-composition">
            <div className="home-credential-object">
              <LanyardPreview
                className="home-lanyard"
                title="Product Design Foundations"
                issuerName="Northstar Learning"
                issueDate="2025-06-01"
                recipientName="Avery Chen"
                recipientHandle="averychen"
                description="An illustrative achievement preview"
                illustrative
              />
            </div>
            <div className="home-credential-copy">
              <h3>Made to be carried. Built to be checked.</h3>
              <p>
                Lead with the accomplishment. Open the details when you need them. A visitor can
                independently check a credential without connecting a wallet or creating an account.
              </p>
              <div className="home-credential-points">
                <div>
                  <span className="home-point-mark">
                    <CheckIcon size={15} />
                  </span>
                  Achievement and issuer stay in focus
                </div>
                <div>
                  <span className="home-point-mark">
                    <CheckIcon size={15} />
                  </span>
                  Proof details remain available when needed
                </div>
                <div>
                  <span className="home-point-mark">
                    <CheckIcon size={15} />
                  </span>
                  Visitors can verify without signing in
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="home-section home-sharing-section" aria-labelledby="sharing-title">
        <div className="home-section-inner">
          <h2 id="sharing-title">Share with confidence.</h2>
          <p className="home-section-intro">
            A clear public link makes it easy to share the profile you choose and the credentials
            you want people to see.
          </p>
          <div className="home-share-composition">
            <article className="home-share-panel">
              <div className="home-share-copy">
                <h3>Your profile, ready to travel.</h3>
                <p>
                  Choose what is public, then share one memorable link with a recruiter,
                  collaborator or community.
                </p>
              </div>
              <div className="home-share-link">
                <span>credora.app/u/your-handle</span>
                <span>Profile link</span>
              </div>
              <p className="home-share-note">
                Illustrative link format. Public profiles are opt-in.
              </p>
            </article>
            <article className="home-share-panel">
              <div className="home-share-copy">
                <h3>Issuers add context.</h3>
                <p>
                  Organizations can present their programs and issue achievements that recipients
                  can carry into their professional story.
                </p>
              </div>
              <div className="home-org-card">
                <div className="home-org-card-head">
                  <span className="home-org-card-mark">N</span>
                  <div>
                    <h3>Northstar Learning</h3>
                    <p>Illustrative organization page</p>
                  </div>
                </div>
                <div className="home-org-row">
                  <span>Product Design Foundations</span>
                  <span>Achievement</span>
                </div>
                <div className="home-org-row">
                  <span>Applied Research Studio</span>
                  <span>Program</span>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="home-closing" aria-labelledby="closing-title">
        <div className="home-closing-inner">
          <div>
            <h2 id="closing-title">Start with what you’ve done.</h2>
            <p>
              Build your profile, choose what to share, and give your achievements a home of their
              own.
            </p>
          </div>
          <Button asChild>
            <a href="/profile">
              Build your profile <ArrowUpRightIcon />
            </a>
          </Button>
        </div>
      </section>
    </main>
  );
}
