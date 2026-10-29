import { createFileRoute } from '@tanstack/react-router';
import { VerifyForm } from '../components/verify-form';

export const Route = createFileRoute('/verify')({ component: VerifyPage });

function VerifyPage() {
  return (
    <main className="page-width narrow-page">
      <h1>Check the record.</h1>
      <p className="lede">
        Scan a credential QR or upload its image. No wallet, account, or issuer relationship is
        needed.
      </p>
      <VerifyForm />
    </main>
  );
}
