import { createFileRoute } from '@tanstack/react-router';
import { JoinPage } from '../components/account-entry';

export const Route = createFileRoute('/join')({ component: JoinPage });
