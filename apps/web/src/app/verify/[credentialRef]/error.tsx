'use client';

import { useTransition } from 'react';

export default function VerificationError({ reset }: { reset: () => void }) {
  const [isPending, startTransition] = useTransition();

  return (
    <main className="page-width narrow-page">
      <h1>We couldn’t check that record.</h1>
      <p className="lede">
        The verification page hit an unexpected problem. Your reference is unchanged; try the lookup
        again or return to the verification form.
      </p>
      <div className="verification-actions">
        <button
          className="button button-dark"
          type="button"
          onClick={() => startTransition(() => reset())}
          disabled={isPending}
        >
          {isPending ? 'Trying again…' : 'Try again'}
        </button>
        <a className="text-link" href="/verify">
          Back to verification
        </a>
      </div>
    </main>
  );
}
