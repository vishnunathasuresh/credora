import { createFileRoute } from '@tanstack/react-router';
import { ProfileEditor } from '../components/profile-page';

export const Route = createFileRoute('/profile')({ component: ProfileEditor });
