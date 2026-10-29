import { createFileRoute } from '@tanstack/react-router';
import { IssuerWorkspace } from '../components/issuer-workspace';

export const Route = createFileRoute('/org')({
  component: () => <IssuerWorkspace audience="organization" />,
});
