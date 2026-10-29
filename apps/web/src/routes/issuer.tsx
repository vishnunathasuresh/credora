import { createFileRoute } from '@tanstack/react-router';
import { IssuerWorkspace } from '../components/issuer-workspace';

export const Route = createFileRoute('/issuer')({
  component: () => <IssuerWorkspace audience="issuer" />,
});
