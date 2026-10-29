'use client';
import { Button } from './ui/button';

import { useRouter } from '@tanstack/react-router';
import { useTransition } from 'react';

export function RetryVerification() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      className="button button-dark"
      type="button"
      onClick={() =>
        startTransition(async () => {
          await router.invalidate();
        })
      }
      disabled={isPending}
    >
      {isPending ? 'Checking again…' : 'Try again'}
    </Button>
  );
}
