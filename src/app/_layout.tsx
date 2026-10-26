import { InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { bootAuth, useAuth } from '@/lib/auth';
import { demoSeed } from '@/lib/demo';
import { initData, resetData } from '@/lib/store';
import { useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const t = useTheme();
  const status = useAuth((s) => s.status);
  const userId = useAuth((s) => s.user?.id);
  const [fontsLoaded, fontError] = useFonts({
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  useEffect(() => {
    void bootAuth();
  }, []);

  // wire the data layer to whoever is signed in
  useEffect(() => {
    if (status === 'signedIn' && userId) initData(userId, 'remote');
    else if (status === 'demo') initData('demo', 'local', () => demoSeed());
    else if (status === 'signedOut') resetData();
  }, [status, userId]);

  const ready = (fontsLoaded || !!fontError) && status !== 'loading';
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;
  const authed = status === 'signedIn' || status === 'demo';

  const nav = t.scheme === 'dark' ? DarkTheme : DefaultTheme;
  return (
    <ThemeProvider
      value={{ ...nav, colors: { ...nav.colors, background: t.bg, card: t.bg, text: t.ink, primary: t.ink } }}>
      <StatusBar style={t.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
        <Stack.Protected guard={authed} redirectTo="/sign-in">
          <Stack.Screen name="index" />
          <Stack.Screen name="category/[id]" />
          <Stack.Screen name="insights" />
          <Stack.Screen name="edit-category" options={{ presentation: 'modal' }} />
          <Stack.Screen name="ask" options={{ presentation: 'modal' }} />
          <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
          <Stack.Screen
            name="log-time"
            options={{
              presentation: 'formSheet',
              sheetAllowedDetents: [0.62, 0.92],
              sheetGrabberVisible: true,
              sheetCornerRadius: 28,
              contentStyle: { backgroundColor: t.surface },
            }}
          />
        </Stack.Protected>
        <Stack.Protected guard={!authed} redirectTo="/">
          <Stack.Screen name="sign-in" options={{ animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Screen name="auth/callback" />
        <Stack.Screen name="explore" />
      </Stack>
    </ThemeProvider>
  );
}
