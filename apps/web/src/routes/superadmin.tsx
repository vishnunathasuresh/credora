import { createFileRoute } from '@tanstack/react-router';
import { AdminWorkspace } from '../components/admin-workspace';

export const Route = createFileRoute('/superadmin')({ component: AdminWorkspace });
