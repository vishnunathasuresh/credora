const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000';

export type ApiError = Error & { status?: number; code?: string };

export async function credoraApi<T>(path: string, options: RequestInit = {}, token?: string) {
  let response: Response;
  try {
    response = await fetch(`${apiUrl.replace(/\/$/, '')}${path}`, {
      ...options,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(options.headers ?? {}),
      },
    });
  } catch {
    const error = new Error('Unable to reach the Credora API right now.') as ApiError;
    error.code = 'API_UNAVAILABLE';
    throw error;
  }
  const body = (await response.json().catch(() => ({}))) as T & {
    message?: string;
    error?: string;
  };
  if (!response.ok) {
    const error = new Error(body.message ?? body.error ?? 'Credora API request failed') as ApiError;
    error.status = response.status;
    error.code = body.error;
    throw error;
  }
  return body as T;
}

export function apiUrlFor(path: string) {
  return `${apiUrl.replace(/\/$/, '')}${path}`;
}
