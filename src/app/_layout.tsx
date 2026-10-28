import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
} from '@expo-google-fonts/nunito';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Appearance } from 'react-native';

import { DialogHost } from '@/components/dialog-host';
import { bootAuth, useAuth } from '@/lib/auth';
import { demoSeed } from '@/lib/demo';
import { usePrefs } from '@/lib/prefs';
import { initData, resetData } from '@/lib/store';
import { useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const t = useTheme();
  const status = useAuth((s) => s.status);
  const userId = useAuth((s) => s.user?.id);
  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });
  const themePref = usePrefs((s) => s.theme);

  // Keep native UI (sheets, pickers, alerts, switches) in step with Settings → Appearance.
  useEffect(() => {
    try {
      Appearance.setColorScheme(themePref === 'system' ? 'auto' : themePref);
    } catch {}
  }, [themePref]);

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
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: t.bg },
          // swipe right from anywhere on the screen (not just the edge) to go back
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
        }}>
        <Stack.Protected guard={authed} redirectTo="/sign-in">
          <Stack.Screen name="index" />
          <Stack.Screen name="category/[id]" />
          <Stack.Screen name="insights" />
          <Stack.Screen name="add" />
          <Stack.Screen name="edit-category" options={{ presentation: 'modal' }} />
          <Stack.Screen name="ask" options={{ presentation: 'modal' }} />
          <Stack.Screen name="settings" />
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
      <DialogHost />
    </ThemeProvider>
  );
}
