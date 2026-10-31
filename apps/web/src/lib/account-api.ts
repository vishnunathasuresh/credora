import { credoraApi } from './credora-api';
import { accountAccessToken } from './account-session';

export async function accountApi<T>(
  path: string,
  options: RequestInit = {},
  expectedUserId?: string,
) {
  const token = await accountAccessToken(expectedUserId);
  return credoraApi<T>(path, options, token);
}

export type AccountProfileResponse<TProfile = unknown> = {
  account: { id: string };
  profile: TProfile | null;
  wallets: { address: `0x${string}`; linkedAt: string }[];
};
