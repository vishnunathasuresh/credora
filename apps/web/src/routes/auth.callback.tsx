import { createFileRoute } from '@tanstack/react-router';
import { AuthCallbackPage } from '../components/account-entry';

export const Route = createFileRoute('/auth/callback')({ component: AuthCallbackPage });
