import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { publicEnv } from './public-env';

let clientPromise: Promise<SupabaseClient> | undefined;
let callbackPromise: Promise<Session> | undefined;

export type AccountSession = Session;
export type AccountUser = User;

export class AccountAuthError extends Error {
  constructor(
    message: string,
    readonly code: 'CONFIG_MISSING' | 'AUTH_UNAVAILABLE' | 'AUTH_FAILED',
  ) {
    super(message);
    this.name = 'AccountAuthError';
  }
}

export function accountAuthConfigured() {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabasePublishableKey);
}

async function supabaseClient() {
  if (!accountAuthConfigured())
    throw new AccountAuthError(
      'Google sign-in is not configured for this environment.',
      'CONFIG_MISSING',
    );
  clientPromise ??= import('@supabase/supabase-js')
    .then(({ createClient }) =>
      createClient(publicEnv.supabaseUrl!, publicEnv.supabasePublishableKey!, {
        auth: {
          flowType: 'pkce',
          detectSessionInUrl: false,
        },
      }),
    )
    .catch(() => {
      clientPromise = undefined;
      throw new AccountAuthError('Account sign-in is temporarily unavailable.', 'AUTH_UNAVAILABLE');
    });
  return clientPromise;
}

export async function getAccountSession() {
  const client = await supabaseClient();
  const { data, error } = await client.auth.getSession();
  if (error)
    throw new AccountAuthError('Could not check your account session.', 'AUTH_UNAVAILABLE');
  return data.session ?? undefined;
}

export async function accountAccessToken() {
  const session = await getAccountSession();
  if (!session) throw new AccountAuthError('Sign in to continue.', 'AUTH_FAILED');
  return session.access_token;
}

export async function subscribeAccountSession(
  callback: (session: AccountSession | undefined) => void,
) {
  const client = await supabaseClient();
  const { data } = client.auth.onAuthStateChange((_event, session) => {
    callback(session ?? undefined);
  });
  return () => data.subscription.unsubscribe();
}

export async function signInWithGoogle() {
  const client = await supabaseClient();
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
  if (error) throw new AccountAuthError(error.message, 'AUTH_FAILED');
}

export async function finishGoogleCallback() {
  callbackPromise ??= (async () => {
    const client = await supabaseClient();
    const params = new URLSearchParams(window.location.search);
    const providerError = params.get('error_description') ?? params.get('error');
    if (providerError) throw new AccountAuthError(providerError, 'AUTH_FAILED');
    const code = params.get('code');
    if (code) {
      const { data, error } = await client.auth.exchangeCodeForSession(code);
      if (error || !data.session)
        throw new AccountAuthError(
          'Google sign-in could not be completed. Please try again.',
          'AUTH_FAILED',
        );
      window.history.replaceState({}, document.title, '/auth/callback');
      return data.session;
    }
    const { data, error } = await client.auth.getSession();
    if (error || !data.session)
      throw new AccountAuthError(
        'The sign-in link is missing or expired. Please try again.',
        'AUTH_FAILED',
      );
    return data.session;
  })().catch((error: unknown) => {
    callbackPromise = undefined;
    throw error;
  });
  return callbackPromise;
}

export async function signOutAccount() {
  const client = await supabaseClient();
  const { error } = await client.auth.signOut({ scope: 'local' });
  if (error) throw new AccountAuthError('Could not sign out of this account.', 'AUTH_UNAVAILABLE');
}
