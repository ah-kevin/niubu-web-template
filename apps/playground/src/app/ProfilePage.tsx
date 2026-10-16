import { ProfileSkeleton } from '@niubu/layouts/widgets';
import { useAuthSnapshot } from '../auth/context';
export function ProfilePage() {
  const state = useAuthSnapshot();
  return <ProfileSkeleton displayName={state.user?.name ?? ''} />;
}
