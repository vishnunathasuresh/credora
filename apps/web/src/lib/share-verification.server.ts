import {
  fetchIssuerProfile,
  fetchVerification,
  shouldLookupIssuerProfile,
  type VerificationResult,
} from './verification.server';

export type ShareVerificationItem = {
  hash: string;
  result: VerificationResult;
  issuerProfile: { name: string; websiteUrl: string; logoUrl: string | null } | null;
};

export type ShareVerificationData = {
  expiresAt: string;
  credentials: ShareVerificationItem[];
  error?: string;
  errorCode?: string;
};

const apiUrl = () =>
  (process.env.VITE_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000').replace(
    /\/$/,
    '',
  );

const maxShareResolutionBytes = 32 * 1024;

export async function readBoundedShareJson(
  response: Response,
  signal: AbortSignal,
): Promise<unknown> {
  const declaredLength = response.headers.get('content-length');
  if (
    declaredLength &&
    /^\d+$/.test(declaredLength) &&
    Number(declaredLength) > maxShareResolutionBytes
  ) {
    await response.body?.cancel();
    throw new Error('Share response exceeds the allowed size.');
  }
  if (!response.body) throw new Error('Share response has no body.');

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  const cancelOnAbort = () => {
    void reader.cancel(signal.reason).catch(() => undefined);
  };
  signal.addEventListener('abort', cancelOnAbort, { once: true });
  try {
    while (true) {
      if (signal.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
      const { done, value } = await reader.read();
      if (signal.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
      if (done) break;
      size += value.byteLength;
      if (size > maxShareResolutionBytes) {
        await reader.cancel();
        throw new Error('Share response exceeds the allowed size.');
      }
      chunks.push(value);
    }
  } finally {
    signal.removeEventListener('abort', cancelOnAbort);
    reader.releaseLock();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function fetchShareResolution(
  token: string,
  timeoutMs = 8000,
  fetchImpl: typeof fetch = fetch,
): Promise<
  | { ok: true; expiresAt: string; credentials: { credentialHash: string }[] }
  | { ok: false; error: string; errorCode: string }
> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new DOMException('Timed out', 'TimeoutError')),
    timeoutMs,
  );
  try {
    const response = await fetchImpl(`${apiUrl()}/wallet/share-resolution`, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
      signal: controller.signal,
    });
    const body = (await readBoundedShareJson(response, controller.signal).catch(() => ({}))) as {
      expiresAt?: string;
      credentials?: { credentialHash: string }[];
      message?: string;
      error?: string;
    };
    if (controller.signal.aborted) throw controller.signal.reason;
    if (!response.ok)
      return {
        ok: false,
        error: body.message ?? 'This share cannot be opened.',
        errorCode: body.error ?? '',
      };
    if (
      !body.expiresAt ||
      !Number.isFinite(Date.parse(body.expiresAt)) ||
      !Array.isArray(body.credentials) ||
      body.credentials.length < 1 ||
      body.credentials.length > 25 ||
      body.credentials.some((item) => typeof item?.credentialHash !== 'string')
    )
      return { ok: false, error: 'The share response was malformed.', errorCode: '' };
    return { ok: true, expiresAt: body.expiresAt, credentials: body.credentials };
  } catch {
    return {
      ok: false,
      error: 'The sharing service is unavailable. Retry when it recovers.',
      errorCode: '',
    };
  } finally {
    clearTimeout(timeout);
  }
}

const resolveShare = (token: string) => fetchShareResolution(token);

type ShareLoaderDependencies = {
  resolve: typeof resolveShare;
  verify: typeof fetchVerification;
  issuerProfile: typeof fetchIssuerProfile;
};

export async function loadShareVerificationData(
  token: string,
  dependencies: ShareLoaderDependencies = {
    resolve: resolveShare,
    verify: fetchVerification,
    issuerProfile: fetchIssuerProfile,
  },
): Promise<ShareVerificationData> {
  const firstResolution = await dependencies.resolve(token);
  if (!firstResolution.ok)
    return {
      expiresAt: '',
      credentials: [],
      error: firstResolution.error,
      errorCode: firstResolution.errorCode,
    };

  const credentials = await Promise.all(
    firstResolution.credentials.map(async ({ credentialHash }) => {
      try {
        const result = await dependencies.verify(credentialHash);
        const issuerProfile = shouldLookupIssuerProfile(result)
          ? await dependencies.issuerProfile(result.metadata!.issuerAddress)
          : null;
        return { hash: credentialHash, result, issuerProfile };
      } catch {
        return {
          hash: credentialHash,
          result: {
            state: 'ledger-unavailable' as const,
            source: 'direct-rpc' as const,
            message: 'Unable to check this credential directly right now.',
          },
          issuerProfile: null,
        };
      }
    }),
  );

  // Resolve the bearer share again after potentially slow registry and gateway checks.
  const finalResolution = await dependencies.resolve(token);
  if (!finalResolution.ok)
    return {
      expiresAt: '',
      credentials: [],
      error: finalResolution.error,
      errorCode: finalResolution.errorCode,
    };
  if (Date.parse(finalResolution.expiresAt) <= Date.now())
    return {
      expiresAt: '',
      credentials: [],
      error: 'This share code has expired or was turned off.',
      errorCode: 'SHARE_EXPIRED',
    };

  return { expiresAt: finalResolution.expiresAt, credentials };
}
