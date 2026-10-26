import { Redirect } from 'expo-router';

import { useAuth } from '@/lib/auth';

// Leftover route from the Expo template. Safe to delete; kept as a redirect
// so old links land somewhere sensible.
export default function Explore() {
  const status = useAuth((s) => s.status);
  return <Redirect href={status === 'signedIn' || status === 'demo' ? '/' : '/sign-in'} />;
}
