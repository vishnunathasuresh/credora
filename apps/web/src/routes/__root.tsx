import { createRootRoute, HeadContent, Link, Outlet, Scripts } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import appCss from '../styles/globals.css?url';
import { MobileNavigation } from '../components/mobile-navigation';
import { ThemeToggle } from '../components/theme-toggle';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Credora — credentials you can carry' },
      { name: 'description', content: 'Issue, own, and independently verify digital credentials.' },
      { name: 'application-name', content: 'Credora' },
      { name: 'theme-color', content: '#f4f1ea' },
      { name: 'color-scheme', content: 'light dark' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'manifest', href: '/manifest.webmanifest' },
      { rel: 'icon', href: '/icon.svg' },
      { rel: 'apple-touch-icon', href: '/icon.svg' },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <div className="shell credora-shell">
        <header className="topbar credora-topbar">
          <Link className="wordmark" to="/" aria-label="Credora home">
            <span className="mark">C</span>
            <span>credora</span>
          </Link>
          <div className="header-controls">
            <nav className="nav desktop-nav" aria-label="Primary navigation">
              <Link to="/profile">My profile</Link>
              <Link to="/verify">Verify</Link>
              <Link to="/wallet">My credentials</Link>
              <Link className="nav-cta" to="/dashboard">
                Workspaces
              </Link>
            </nav>
            <ThemeToggle />
            <MobileNavigation />
          </div>
        </header>
        <div id="main-content" tabIndex={-1}>
          <Outlet />
        </div>
        <footer className="footer">
          <span>Credora · independently verifiable credentials</span>
        </footer>
      </div>
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <HeadContent />
      </head>
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
