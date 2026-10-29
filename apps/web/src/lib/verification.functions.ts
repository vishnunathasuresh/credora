import { createServerFn } from '@tanstack/react-start';
import {
  fetchIssuerProfile,
  fetchRecipientProfile,
  fetchVerification,
} from './verification.server';

export const loadCredentialVerification = createServerFn({ method: 'GET' })
  .validator((data: { credentialRef: string }) => data)
  .handler(async ({ data }) => {
    const isHash = /^0x[0-9a-fA-F]{64}$/.test(data.credentialRef);
    const result = isHash
      ? await fetchVerification(data.credentialRef)
      : { state: 'malformed' as const, message: 'This reference is not a valid credential hash.' };
    const [issuerProfile, recipientProfile] =
      result.state === 'valid' && result.metadata
        ? await Promise.all([
            fetchIssuerProfile(result.metadata.issuerAddress),
            fetchRecipientProfile(data.credentialRef),
          ])
        : [null, null];
    return { result, issuerProfile, recipientProfile };
  });
