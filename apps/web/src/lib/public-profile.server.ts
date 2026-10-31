import type { Profile } from '../components/profile-page';

export type PublicProfileResult =
  { state: 'found'; profile: Profile } | { state: 'missing' | 'unavailable'; profile: null };

export async function fetchPublicProfile(handle: string): Promise<PublicProfileResult> {
  if (!/^[a-z0-9_]{3,30}$/i.test(handle)) return { state: 'missing', profile: null };
  const api =
    process.env.VITE_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000';
  try {
    const response = await fetch(
      `${api.replace(/\/$/, '')}/profiles/${encodeURIComponent(handle)}`,
      {
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      },
    );
    if (response.status === 404 || response.status === 400)
      return { state: 'missing', profile: null };
    if (!response.ok) return { state: 'unavailable', profile: null };
    const body = (await response.json()) as { profile?: Profile };
    return body.profile
      ? { state: 'found', profile: body.profile }
      : { state: 'missing', profile: null };
  } catch {
    return { state: 'unavailable', profile: null };
  }
}
