import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { completeAuthFromUrl, useAuth } from '@/lib/auth';
import { useTheme } from '@/theme';

/**
 * Deep-link landing for OAuth. On iOS the auth session normally intercepts
 * the redirect itself, so this only runs if the link opens the app directly.
 */
export default function AuthCallback() {
  const t = useTheme();
  const params = useLocalSearchParams<{ code?: string }>();
  const status = useAuth((s) => s.status);
  const needsExchange = status !== 'signedIn' && !!params.code;
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!needsExchange) return;
    completeAuthFromUrl(`occur://auth/callback?code=${params.code}`)
      .catch(() => {})
      .finally(() => setDone(true));
  }, [needsExchange, params.code]);

  if (!needsExchange || done) return <Redirect href={status === 'signedIn' || status === 'demo' ? '/' : '/sign-in'} />;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg }}>
      <ActivityIndicator color={t.ink} />
    </View>
  );
}
