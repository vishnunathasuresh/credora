import { createServerFn } from '@tanstack/react-start';
import { fetchPublicProfile } from './public-profile.server';

export const loadPublicProfile = createServerFn({ method: 'GET' })
  .validator((data: { handle: string }) => ({ handle: String(data.handle).slice(0, 100) }))
  .handler(({ data }) => fetchPublicProfile(data.handle));
