import { createFileRoute } from '@tanstack/react-router';
import { AccountWalletSettings } from '../components/account-wallets';

export const Route = createFileRoute('/settings/wallets')({ component: AccountWalletSettings });
