import { verifyMessage, type Address } from 'viem';
import type { Role } from '@credora/shared';

export type AuthChallenge = {
  address: Address;
  nonce: string;
  message: string;
  expiresAt: string;
};

export type AuthSession = {
  token: string;
  address: Address;
  roles: Role[];
  expiresAt: string;
};

export function buildAuthMessage(challenge: AuthChallenge): string {
  return [
    'Credora wants you to sign in with your Ethereum account:',
    challenge.address,
    '',
    'Authenticate this wallet to access Credora.',
    '',
    `Nonce: ${challenge.nonce}`,
    `Issued At: ${challenge.expiresAt}`,
  ].join('\n');
}

export async function verifyAuthSignature(
  challenge: AuthChallenge,
  signature: `0x${string}`,
): Promise<boolean> {
  return verifyMessage({ address: challenge.address, message: challenge.message, signature });
}

export function createNonce(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}
