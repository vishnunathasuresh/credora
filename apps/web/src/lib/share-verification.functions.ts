import { createServerFn } from '@tanstack/react-start';
import { setResponseHeader } from '@tanstack/react-start/server';

export type { ShareVerificationData } from './share-verification.server';

export const loadShareVerification = createServerFn({ method: 'POST' })
  .validator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    setResponseHeader('cache-control', 'no-store');
    const { loadShareVerificationData } = await import('./share-verification.server');
    return await loadShareVerificationData(data.token);
  });
