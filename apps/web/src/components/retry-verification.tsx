'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

export function RetryVerification() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      className="button button-dark"
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={isPending}
    >
      {isPending ? 'Checking again…' : 'Try again'}
    </button>
  );
}
