import { createFileRoute } from '@tanstack/react-router';
import { VerifyForm } from '../components/verify-form';

export const Route = createFileRoute('/verify')({ component: VerifyPage });

function VerifyPage() {
  return (
    <main className="page-width narrow-page workspace-page">
      <header className="app-page-header">
        <div>
          <h1>Verify a credential</h1>
          <p className="lede">Check a public credential record without an account or wallet.</p>
        </div>
      </header>
      <VerifyForm />
    </main>
  );
}
