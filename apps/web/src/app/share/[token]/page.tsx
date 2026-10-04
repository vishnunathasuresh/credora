import type { Metadata } from 'next';
import { SharePresentation } from '../../../components/share-presentation';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Shared credentials · Credora',
  robots: { index: false, follow: false, noarchive: true },
};

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token))
    return (
      <main className="page-width narrow-page share-presentation-page">
        <h1>Share code not understood.</h1>
        <p className="lede">Check the QR code or ask the holder to create a new share.</p>
      </main>
    );
  return <SharePresentation token={token} />;
}
