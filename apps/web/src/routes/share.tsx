import { useEffect, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { SharePresentation } from '../components/share-presentation';
import { loadShareVerification } from '../lib/share-verification.functions';
import type { ShareVerificationData } from '../lib/share-verification.functions';

export const Route = createFileRoute('/share')({
  headers: () => ({
    'Referrer-Policy': 'no-referrer',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'Cache-Control': 'no-store',
  }),
  head: () => ({
    meta: [
      { title: 'Shared credentials · Credora' },
      { name: 'robots', content: 'noindex, nofollow, noarchive' },
    ],
  }),
  component: SharePage,
});

function SharePage() {
  const [data, setData] = useState<ShareVerificationData>();

  useEffect(() => {
    let requestId = 0;
    const resolveCurrentHash = () => {
      const currentRequest = ++requestId;
      const token = window.location.hash.slice(1);
      setData(undefined);
      if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
        setData({
          expiresAt: '',
          credentials: [],
          error: 'Share code not understood.',
          errorCode: 'SHARE_NOT_FOUND',
        });
        return;
      }
      void loadShareVerification({ data: { token } })
        .then((result) => {
          if (currentRequest === requestId) setData(result);
        })
        .catch(() => {
          if (currentRequest === requestId)
            setData({
              expiresAt: '',
              credentials: [],
              error: 'The sharing service is unavailable. Retry when it recovers.',
              errorCode: '',
            });
        });
    };
    resolveCurrentHash();
    window.addEventListener('hashchange', resolveCurrentHash);
    return () => {
      requestId++;
      window.removeEventListener('hashchange', resolveCurrentHash);
    };
  }, []);

  if (!data)
    return (
      <main className="page-width narrow-page workspace-page share-presentation-page">
        <h1>Opening shared credentials…</h1>
      </main>
    );

  return <SharePresentation data={data} />;
}
