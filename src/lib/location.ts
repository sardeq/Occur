import * as Location from 'expo-location';
import { Platform } from 'react-native';

/** Ask once, when the user turns on "remember where" for a category. */
export async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const cur = await Location.getForegroundPermissionsAsync();
  if (cur.granted) return true;
  if (!cur.canAskAgain) return false;
  const res = await Location.requestForegroundPermissionsAsync();
  return res.granted;
}

const round = (n: number) => Math.round(n * 10_000) / 10_000; // ~11 m — enough for "where", not a tracker

/**
 * Best-effort, never prompts. Prefers a recent cached fix (instant, no GPS
 * spin-up), falls back to a balanced-accuracy fix, then reverse geocodes to a
 * short human label.
 */
export async function captureLocation(): Promise<{ latitude: number; longitude: number; place: string | null } | null> {
  if (Platform.OS === 'web') return null;
  const perm = await Location.getForegroundPermissionsAsync();
  if (!perm.granted) return null;

  let pos = await Location.getLastKnownPositionAsync({ maxAge: 2 * 60_000, requiredAccuracy: 250 });
  if (!pos) pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  if (!pos) return null;

  const latitude = round(pos.coords.latitude);
  const longitude = round(pos.coords.longitude);
  let place: string | null = null;
  try {
    const [g] = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (g) {
      const first = g.name && !/^\d/.test(g.name) ? g.name : g.street;
      place = [first, g.district ?? g.city].filter(Boolean).join(', ').slice(0, 120) || null;
    }
  } catch {
    place = null;
  }
  return { latitude, longitude, place };
}
