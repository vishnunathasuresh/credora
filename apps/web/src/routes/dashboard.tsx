import { createFileRoute } from '@tanstack/react-router';
import { RoleDashboard } from '../components/role-dashboard';

export const Route = createFileRoute('/dashboard')({ component: RoleDashboard });
