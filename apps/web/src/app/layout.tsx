import type { Metadata, Viewport } from 'next';
import '../styles/globals.css';
import { MobileNavigation } from '../components/mobile-navigation';
import { ThemeToggle } from '../components/theme-toggle';

export const metadata: Metadata = {
  title: 'Credora — credentials you can carry',
  description: 'Issue, own, and independently verify digital credentials.',
  applicationName: 'Credora',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#f4f1ea',
  colorScheme: 'light dark',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <div className="shell">
          <header className="topbar">
            <a className="wordmark" href="/" aria-label="Credora home">
              <span className="mark">C</span>
              <span>credora</span>
            </a>
            <div className="header-controls">
              <nav className="nav desktop-nav" aria-label="Primary navigation">
                <a href="/verify">Verify</a>
                <a href="/wallet">My credentials</a>
                <a href="/demo">Demo data</a>
                <a href="/#how-it-works">How it works</a>
                <a className="nav-cta" href="/dashboard">
                  Open workspace
                </a>
              </nav>
              <ThemeToggle />
              <MobileNavigation />
            </div>
          </header>
          <div id="main-content" tabIndex={-1}>
            {children}
          </div>
          <footer className="footer">
            <span>Credora protocol · open, portable, independently checkable</span>
            <span>Built for the next keeper of your work</span>
          </footer>
        </div>
      </body>
    </html>
  );
}
