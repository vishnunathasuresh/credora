import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  Scripts,
  useRouterState,
} from '@tanstack/react-router';
import type { ReactNode } from 'react';
import appCss from '../styles/globals.css?url';
import shellCss from '../styles/shell-redesign.css?url';
import { MobileNavigation } from '../components/mobile-navigation';
import { ThemeToggle } from '../components/theme-toggle';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Credora — work worth sharing, proof you can check' },
      {
        name: 'description',
        content:
          'Build a professional profile around your work and independently verifiable credentials.',
      },
      { name: 'application-name', content: 'Credora' },
      { name: 'theme-color', content: '#f8f7f1' },
      { name: 'color-scheme', content: 'light dark' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'stylesheet', href: shellCss },
      { rel: 'manifest', href: '/manifest.webmanifest' },
      { rel: 'icon', href: '/icon.svg' },
      { rel: 'apple-touch-icon', href: '/icon.svg' },
    ],
  }),
  component: RootComponent,
  notFoundComponent: RootNotFound,
  errorComponent: RootError,
});

const primaryLinks = [
  { to: '/profile', label: 'My profile' },
  { to: '/credentials', label: 'My credentials' },
  { to: '/verify', label: 'Verify a credential' },
] as const;

function RootComponent() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const landing = pathname === '/';
  const workspace = [
    '/profile',
    '/wallet',
    '/credentials',
    '/dashboard',
    '/issuer',
    '/org',
    '/admin',
    '/superadmin',
    '/settings/wallets',
  ].some((path) => pathname === path || pathname.startsWith(`${path}/`));
  return (
    <RootDocument>
      <div
        className={`shell credora-shell ${landing ? 'landing-shell' : workspace ? 'workspace-shell' : 'public-shell'}`}
      >
        <header className="topbar credora-topbar">
          <Link className="wordmark" to="/" aria-label="Credora home">
            <span className="mark">C</span>
            <span>credora</span>
          </Link>
          {workspace ? (
            <div className="header-controls workspace-header-controls">
              <Link className="topbar-verify-link" to="/verify">
                Verify a credential
              </Link>
              <ThemeToggle />
            </div>
          ) : (
            <div className="header-controls">
              <nav className="nav desktop-nav" aria-label="Primary navigation">
                <Link to="/verify">Verify</Link>
                <Link to="/credentials">My credentials</Link>
                <Link className="nav-cta" to="/join">
                  Create a profile
                </Link>
              </nav>
              <ThemeToggle />
              <MobileNavigation />
            </div>
          )}
        </header>
        {workspace ? (
          <div className="app-shell">
            <aside className="app-sidebar" aria-label="Workspace navigation">
              <p className="app-sidebar-label">Your space</p>
              <nav className="app-sidebar-nav">
                {primaryLinks.slice(0, 2).map((item) => (
                  <SidebarLink
                    key={item.to}
                    to={item.to}
                    label={item.label}
                    current={
                      pathname === item.to || (item.to === '/credentials' && pathname === '/wallet')
                    }
                  />
                ))}
              </nav>
              <div className="app-sidebar-divider" />
              <p className="app-sidebar-label">Workspace</p>
              <nav className="app-sidebar-nav">
                <SidebarLink
                  to="/dashboard"
                  label="Workspace home"
                  current={pathname === '/dashboard'}
                />
                <SidebarLink
                  to="/settings/wallets"
                  label="Linked wallets"
                  current={pathname === '/settings/wallets'}
                />
              </nav>
              <div className="app-sidebar-divider" />
              <p className="app-sidebar-label">For organizations</p>
              <nav className="app-sidebar-nav">
                <SidebarLink to="/org" label="Organization" current={pathname === '/org'} />
                <SidebarLink
                  to="/issuer"
                  label="Issue credentials"
                  current={pathname === '/issuer'}
                />
              </nav>
            </aside>
            <div className="app-main-column">
              <div className="app-mobile-header">
                <span className="app-mobile-title">{pageTitle(pathname)}</span>
                <MobileNavigation mode="workspace" />
              </div>
              <div id="main-content" className="app-page-content" tabIndex={-1}>
                <Outlet />
              </div>
            </div>
          </div>
        ) : (
          <div id="main-content" tabIndex={-1} className="public-page-content">
            <Outlet />
          </div>
        )}
        {landing && (
          <footer className="footer">
            <span>Credora · professional identity with independently verifiable credentials</span>
            <Link to="/verify">
              Verify a credential <span aria-hidden="true">↗</span>
            </Link>
          </footer>
        )}
      </div>
    </RootDocument>
  );
}

function SidebarLink({
  to,
  label,
  current,
}: {
  to:
    | '/profile'
    | '/credentials'
    | '/verify'
    | '/dashboard'
    | '/settings/wallets'
    | '/org'
    | '/issuer';
  label: string;
  current: boolean;
}) {
  return (
    <Link className="app-sidebar-link" to={to} aria-current={current ? 'page' : undefined}>
      {label}
    </Link>
  );
}
function pageTitle(pathname: string) {
  if (pathname.startsWith('/profile')) return 'My profile';
  if (pathname.startsWith('/wallet') || pathname.startsWith('/credentials'))
    return 'My credentials';
  if (pathname.startsWith('/verify')) return 'Verify';
  if (pathname.startsWith('/issuer')) return 'Issuer workspace';
  if (pathname.startsWith('/org')) return 'Organization';
  if (pathname.startsWith('/admin')) return 'Administration';
  if (pathname.startsWith('/superadmin')) return 'Platform admin';
  if (pathname.startsWith('/settings/wallets')) return 'Linked wallets';
  return 'Workspace';
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

function RootNotFound() {
  return (
    <main className="page-width narrow-page">
      <section className="workspace-panel route-state-card">
        <h1>We couldn’t find that page.</h1>
        <p>Check the address, or return to Credora.</p>
        <div className="home-actions">
          <Link className="button button-primary" to="/">
            Go to Credora
          </Link>
          <Link className="button" to="/verify">
            Verify a credential
          </Link>
        </div>
      </section>
    </main>
  );
}

function RootError({ reset }: { reset: () => void }) {
  return (
    <main className="page-width narrow-page">
      <section className="workspace-panel route-state-card" role="alert">
        <h1>This page couldn’t load.</h1>
        <p>Try again, or return to Credora.</p>
        <div className="home-actions">
          <button className="button button-primary" type="button" onClick={reset}>
            Try again
          </button>
          <Link className="button" to="/verify">
            Verify a credential
          </Link>
        </div>
      </section>
    </main>
  );
}
