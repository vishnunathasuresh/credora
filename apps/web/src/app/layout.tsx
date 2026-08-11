import type { Metadata } from 'next';
import '../styles/globals.css';
import { ThemeToggle } from '../components/theme-toggle';

export const metadata: Metadata = {
  title: 'Credora — credentials you can carry',
  description: 'Issue, own, and independently verify digital credentials.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="topbar">
            <a className="wordmark" href="/" aria-label="Credora home">
              <span className="mark">C</span>
              <span>credora</span>
            </a>
            <nav className="nav" aria-label="Primary navigation">
              <a href="/verify">Verify</a>
              <a href="#how-it-works">How it works</a>
              <ThemeToggle />
            </nav>
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
