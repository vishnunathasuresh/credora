import { createFileRoute } from '@tanstack/react-router';
import { HolderWallet } from '../components/holder-wallet';

export const Route = createFileRoute('/credentials')({ component: HolderWallet });
