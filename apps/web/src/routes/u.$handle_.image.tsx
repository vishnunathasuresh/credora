import { createFileRoute } from '@tanstack/react-router';
import { fetchPublicProfile } from '../lib/public-profile.server';
import { renderProfileImage } from '../lib/profile-image.server';

export const Route = createFileRoute('/u/$handle_/image')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const result = await fetchPublicProfile(params.handle);
        if (!result.profile)
          return new Response(null, {
            status: result.state === 'missing' ? 404 : 503,
            headers: { 'Cache-Control': 'no-store' },
          });
        const png = renderProfileImage(result.profile);
        return new Response(new Uint8Array(png), {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
          },
        });
      },
    },
  },
});
