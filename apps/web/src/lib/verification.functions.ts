import { createServerFn } from '@tanstack/react-start';
import { fetchIssuerProfile, fetchVerification } from './verification.server';

export const loadCredentialVerification = createServerFn({ method: 'GET' })
  .validator((data: { credentialRef: string }) => data)
  .handler(async ({ data }) => {
    const isHash = /^0x[0-9a-fA-F]{64}$/.test(data.credentialRef);
    const result = isHash
      ? await fetchVerification(data.credentialRef)
      : { state: 'malformed' as const, message: 'This reference is not a valid credential hash.' };
    const issuerProfile =
      result.state === 'valid' && result.metadata
        ? await fetchIssuerProfile(result.metadata.issuerAddress)
        : null;
    return { result, issuerProfile };
  });
