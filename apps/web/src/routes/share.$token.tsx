import { createFileRoute } from '@tanstack/react-router';
import { SharePresentation } from '../components/share-presentation';

export const Route = createFileRoute('/share/$token')({
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
  const { token } = Route.useParams();
  if (!/^[A-Za-z0-9_-]{43}$/.test(token))
    return (
      <main className="page-width narrow-page share-presentation-page">
        <h1>Share code not understood.</h1>
        <p className="lede">Check the QR code or ask the holder to create a new share.</p>
      </main>
    );
  return <SharePresentation token={token} />;
}
