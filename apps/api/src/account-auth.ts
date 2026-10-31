import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { CredoraError, isRecord } from '@credora/shared';

export type AccountIdentity = { issuer: string; subject: string; sessionBinding: string };
type UserResult = { data: { user: { id: string } | null }; error: { status?: number } | null };
export type UserVerifier = (token: string) => Promise<UserResult>;

export function createAccountAuthenticator(url?: string, key?: string, verify?: UserVerifier) {
  let issuer: string | undefined;
  try {
    if (url && key) {
      const parsed = new URL(url);
      if (
        parsed.protocol !== 'https:' &&
        !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))
      )
        throw new Error();
      issuer = `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}/auth/v1`;
    }
  } catch {
    /* Missing or invalid configuration is an unavailable service. */
  }
  const verifier =
    issuer && key
      ? (verify ??
        ((token: string) => {
          const client = createClient(url!, key, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
            global: {
              fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8000) }),
            },
          });
          return client.auth.getUser(token);
        }))
      : undefined;
  return async (authorization?: string): Promise<AccountIdentity> => {
    if (!verifier || !issuer)
      throw new CredoraError('Account authentication is unavailable', 'AUTH_UNAVAILABLE', 503);
    if (!authorization?.startsWith('Bearer ') || !authorization.slice(7))
      throw new CredoraError('Sign in to your account', 'UNAUTHORIZED', 401);
    const token = authorization.slice(7);
    let result: UserResult;
    try {
      result = await verifier(token);
    } catch {
      throw new CredoraError('Account authentication is unavailable', 'AUTH_UNAVAILABLE', 503);
    }
    if (result.error) {
      if (result.error.status === 401 || result.error.status === 403 || result.error.status === 400)
        throw new CredoraError('Account session is invalid or expired', 'UNAUTHORIZED', 401);
      throw new CredoraError('Account authentication is unavailable', 'AUTH_UNAVAILABLE', 503);
    }
    if (!result.data.user?.id)
      throw new CredoraError('Account session is invalid or expired', 'UNAUTHORIZED', 401);
    let sessionBinding = createHash('sha256').update(token).digest('hex');
    try {
      const payload: unknown = JSON.parse(
        Buffer.from(token.split('.')[1] ?? '', 'base64url').toString(),
      );
      if (
        isRecord(payload) &&
        typeof payload.session_id === 'string' &&
        payload.session_id.length > 0 &&
        payload.session_id.length <= 200
      )
        sessionBinding = `session:${payload.session_id}`;
    } catch {
      /* Online validation already succeeded; token hash is the safe fallback. */
    }
    return { issuer, subject: result.data.user.id, sessionBinding };
  };
}
