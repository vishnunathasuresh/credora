import { createFileRoute } from '@tanstack/react-router';
import { PublicProfile } from '../components/profile-page';
import { loadPublicProfile } from '../lib/public-profile.functions';

export const Route = createFileRoute('/u/$handle')({
  loader: ({ params }) => loadPublicProfile({ data: { handle: params.handle } }),
  staleTime: 0,
  headers: () => ({ 'Cache-Control': 'no-store' }),
  head: ({ loaderData }) => {
    const profile = loaderData?.profile;
    const title = profile ? `${profile.name} (@${profile.handle}) · Credora` : 'Profile · Credora';
    const description = profile
      ? (profile.headline || profile.bio || `Explore @${profile.handle} on Credora.`).slice(0, 200)
      : 'Professional identity backed by evidence you can check.';
    const path = profile ? `/u/${encodeURIComponent(profile.handle)}` : undefined;
    const base = import.meta.env.VITE_SITE_URL?.replace(/\/$/, '') ?? '';
    return {
      meta: [
        { title },
        { name: 'description', content: description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:type', content: 'profile' },
        ...(path
          ? [
              { property: 'og:url', content: base + path },
              { property: 'og:image', content: `${base}${path}/image` },
              { property: 'og:image:width', content: '1200' },
              { property: 'og:image:height', content: '630' },
              { property: 'og:image:alt', content: `${profile!.name}'s Credora profile` },
              { name: 'twitter:card', content: 'summary_large_image' },
            ]
          : [{ name: 'robots', content: 'noindex, nofollow' }]),
      ],
      links: path ? [{ rel: 'canonical', href: base + path }] : [],
    };
  },
  component: PublicProfileRoute,
});
function PublicProfileRoute() {
  return (
    <PublicProfile
      key={Route.useParams().handle}
      handle={Route.useParams().handle}
      initial={Route.useLoaderData()}
    />
  );
}
