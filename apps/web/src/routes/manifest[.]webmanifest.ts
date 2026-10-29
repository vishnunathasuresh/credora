import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/manifest.webmanifest')({
  server: {
    handlers: {
      GET: () =>
        Response.json(
          {
            name: 'Credora — credentials you can carry',
            short_name: 'Credora',
            description: 'Issue, own, share, and independently verify digital credentials.',
            start_url: '/dashboard',
            scope: '/',
            display: 'standalone',
            background_color: '#f4f1ea',
            theme_color: '#f4f1ea',
            orientation: 'portrait-primary',
            categories: ['education', 'productivity'],
            icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
          },
          { headers: { 'Content-Type': 'application/manifest+json' } },
        ),
    },
  },
});
