import { ArrowUpRightIcon } from './icons';
import { Button } from './ui/button';

export function HomePage() {
  return (
    <main className="home-page">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-copy">
          <h1 id="home-title">
            Your work.
            <br />
            Your name.
          </h1>
          <p>
            A professional identity built around what you’ve done — with credentials others can
            verify.
          </p>
          <div className="home-actions">
            <Button asChild className="home-primary-action">
              <a href="/profile">
                Create your profile <ArrowUpRightIcon />
              </a>
            </Button>
            <a className="home-text-action" href="/wallet">
              My credentials <ArrowUpRightIcon />
            </a>
          </div>
          <a className="home-verify-link" href="/verify">
            Have a credential to check?{' '}
            <span>
              Verify it here <ArrowUpRightIcon />
            </span>
          </a>
        </div>
        <div className="home-artifact" aria-label="Illustrative credential flow">
          <div className="home-artifact-rule">
            <span>Illustrative credential flow</span>
            <span>01 / 01</span>
          </div>
          <div className="home-artifact-stage">
            <div className="sample-cord" aria-hidden="true" />
            <article
              className="sample-credential"
              aria-label="Illustrative credential, not a real record"
            >
              <div className="sample-card-top">
                <span className="sample-mark">EU</span>
                <span>EXAMPLE UNIVERSITY</span>
              </div>
              <div className="sample-card-main">
                <h2>
                  Project
                  <br />
                  Leadership
                </h2>
              </div>
              <div className="sample-card-foot">
                <span>Issuer-backed achievement</span>
                <span className="sample-seal" aria-hidden="true">
                  EU
                </span>
              </div>
            </article>
          </div>
          <p className="home-artifact-caption">
            A clearer way to carry the work behind your next opportunity.
          </p>
        </div>
      </section>
      <section className="home-bottom" aria-label="Explore Credora">
        <span>Identity that travels with your work.</span>
        <a href="/verify">
          Explore public verification <ArrowUpRightIcon />
        </a>
      </section>
    </main>
  );
}
