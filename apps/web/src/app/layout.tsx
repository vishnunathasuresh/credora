import type { Metadata } from 'next';
import '../styles/globals.css';
import { MenuIcon } from '../components/icons';
import { ThemeToggle } from '../components/theme-toggle';

export const metadata: Metadata = {
  title: 'Credora — credentials you can carry',
  description: 'Issue, own, and independently verify digital credentials.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <div className="shell">
          <header className="topbar">
            <a className="wordmark" href="/" aria-label="Credora home">
              <span className="mark">C</span>
              <span>credora</span>
            </a>
            <div className="header-controls">
              <nav className="nav desktop-nav" aria-label="Primary navigation">
                <a href="/verify">Verify</a>
                <a href="/demo">Demo data</a>
                <a href="/#how-it-works">How it works</a>
                <a className="nav-cta" href="/dashboard">
                  Open workspace
                </a>
              </nav>
              <ThemeToggle />
              <details className="mobile-nav">
                <summary>
                  <span>Menu</span>
                  <MenuIcon />
                </summary>
                <nav className="mobile-nav-panel" aria-label="Mobile navigation">
                  <a href="/verify">Verify a credential</a>
                  <a href="/dashboard">Choose workspace</a>
                  <a href="/superadmin">Superadmin control</a>
                  <a href="/org">Organization workspace</a>
                  <a href="/issuer">Issue a credential</a>
                  <a href="/wallet">Open wallet</a>
                  <a href="/demo">Explore demo data</a>
                  <a href="/#how-it-works">How it works</a>
                </nav>
              </details>
            </div>
          </header>
          {children}
          <footer className="footer">
            <span>Credora protocol · open, portable, independently checkable</span>
            <span>Built for the next keeper of your work</span>
          </footer>
        </div>
      </body>
    </html>
  );
}
