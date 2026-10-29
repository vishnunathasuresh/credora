import { createFileRoute } from '@tanstack/react-router';
import { PublicProfile } from '../components/profile-page';

export const Route = createFileRoute('/u/$handle')({
  component: PublicProfileRoute,
});

function PublicProfileRoute() {
  const { handle } = Route.useParams();
  return <PublicProfile handle={handle} />;
}
