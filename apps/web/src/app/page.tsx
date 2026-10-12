import { Button } from '../components/ui/button';
import { VerifyForm } from '../components/verify-form';
import { ArrowUpRightIcon, CheckIcon } from '../components/icons';

const paths = [
  {
    href: '/wallet',
    title: 'Your credentials',
    detail: 'Carry your records and make one share QR for a selected set.',
    action: 'Open wallet',
  },
  {
    href: '/issuer',
    title: 'Issue a credential',
    detail: 'Create a public record, attach an image, and share its verification QR.',
    action: 'Open issuer',
  },
];

export default function HomePage() {
  return (
    <main className="home-page">
      <section className="home-workbench page-width">
        <div className="home-intro">
          <span className="home-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <h1>Credentials that travel.</h1>
          <p>Scan once. Check the public record. No account or wallet needed.</p>
        </div>
        <section className="home-verify-card" aria-labelledby="home-verify-title">
          <div className="home-verify-heading">
            <div>
              <h2 id="home-verify-title">Verify a credential</h2>
              <p>Use a QR code, screenshot, or public link.</p>
            </div>
            <span className="verify-private-note">
              <CheckIcon /> Wallet free
            </span>
          </div>
          <VerifyForm />
        </section>
      </section>

      <section className="home-paths page-width" aria-label="Credora workspaces">
        {paths.map((path) => (
          <a className="home-path-card" href={path.href} key={path.href}>
            <span>{path.title}</span>
            <p>{path.detail}</p>
            <strong>
              {path.action}
              <ArrowUpRightIcon />
            </strong>
          </a>
        ))}
      </section>
      <div className="home-quiet-link">
        <Button asChild variant="ghost">
          <a href="/dashboard">
            All workspaces <ArrowUpRightIcon />
          </a>
        </Button>
      </div>
    </main>
  );
}
