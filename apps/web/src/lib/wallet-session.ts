import { getAddress, type Address } from 'viem';
import type { Role } from '@credora/shared';
import { credoraApi } from './credora-api';

const sessionKey = 'credora-session';

export type WalletSession = {
  token: string;
  address: Address;
  roles: Role[];
  expiresAt: string;
};

export type EthereumProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

export function browserWalletProvider() {
  if (typeof window === 'undefined')
    throw new Error('Wallet access is only available in a browser');
  const provider = (window as Window & { ethereum?: EthereumProvider }).ethereum;
  if (!provider) throw new Error('Install or unlock a browser wallet to continue');
  return provider;
}

export function storedSession(): WalletSession | undefined {
  if (typeof window === 'undefined') return undefined;
  const raw = window.sessionStorage.getItem(sessionKey);
  if (!raw) return undefined;
  try {
    const session = JSON.parse(raw) as WalletSession;
    if (Date.parse(session.expiresAt) <= Date.now()) {
      window.sessionStorage.removeItem(sessionKey);
      return undefined;
    }
    return session;
  } catch {
    window.sessionStorage.removeItem(sessionKey);
    return undefined;
  }
}

export function forgetSession() {
  if (typeof window !== 'undefined') window.sessionStorage.removeItem(sessionKey);
}

export async function connectWalletSession(): Promise<WalletSession> {
  const provider = browserWalletProvider();
  const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[];
  const rawAddress = accounts[0];
  if (!rawAddress) throw new Error('No wallet account was selected');
  const address = getAddress(rawAddress);
  const challenge = await credoraApi<{ message: string }>('/auth/challenge', {
    method: 'POST',
    body: JSON.stringify({ address }),
  });
  const signature = await provider.request({
    method: 'personal_sign',
    params: [challenge.message, address],
  });
  if (typeof signature !== 'string') throw new Error('The wallet did not return a signature');
  const session = await credoraApi<WalletSession>('/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ address, signature }),
  });
  window.sessionStorage.setItem(sessionKey, JSON.stringify(session));
  return session;
}
