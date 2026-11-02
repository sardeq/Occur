import * as Localization from 'expo-localization';
import * as Location from 'expo-location';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { useLangStore, type Lang } from './i18n';
import { kv } from './kv';
import { usePrefs } from './prefs';

/**
 * Picks the app language from where the phone is.
 *
 * "Automatic" (the default) looks at the country, best signal first:
 *  1. a GPS fix — only if location access was already granted (we never
 *     prompt just for this); the country is cached so it's instant next launch
 *  2. the phone's time zone (e.g. Asia/Riyadh)
 *  3. the phone's region setting
 * Arabic-speaking country → Arabic. Otherwise Arabic only if the phone itself
 * is set to Arabic, else English. Settings → Language overrides all of this.
 */

/** Arab League members (ISO 3166-1 alpha-2). */
const ARABIC_COUNTRIES = new Set([
  'AE',
  'BH',
  'DJ',
  'DZ',
  'EG',
  'IQ',
  'JO',
  'KM',
  'KW',
  'LB',
  'LY',
  'MA',
  'MR',
  'OM',
  'PS',
  'QA',
  'SA',
  'SD',
  'SO',
  'SY',
  'TN',
  'YE',
  'EH',
]);

const ZONE_COUNTRY: Record<string, string> = {
  'Asia/Riyadh': 'SA',
  'Asia/Dubai': 'AE',
  'Asia/Qatar': 'QA',
  'Asia/Kuwait': 'KW',
  'Asia/Bahrain': 'BH',
  'Asia/Muscat': 'OM',
  'Asia/Amman': 'JO',
  'Asia/Beirut': 'LB',
  'Asia/Damascus': 'SY',
  'Asia/Baghdad': 'IQ',
  'Asia/Gaza': 'PS',
  'Asia/Hebron': 'PS',
  'Asia/Aden': 'YE',
  'Africa/Cairo': 'EG',
  'Africa/Tripoli': 'LY',
  'Africa/Tunis': 'TN',
  'Africa/Algiers': 'DZ',
  'Africa/Casablanca': 'MA',
  'Africa/El_Aaiun': 'EH',
  'Africa/Khartoum': 'SD',
  'Africa/Nouakchott': 'MR',
  'Africa/Djibouti': 'DJ',
  'Africa/Mogadishu': 'SO',
  'Indian/Comoro': 'KM',
};

const GPS_COUNTRY_KEY = 'occur.gpsCountry.v1';

function timeZone(): string | null {
  try {
    return Localization.getCalendars()[0]?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

function deviceLocale() {
  try {
    return Localization.getLocales()[0] ?? null;
  } catch {
    return null;
  }
}

/** Best guess at which country the phone is in, without prompting. */
export function guessCountry(): string | null {
  let gps: string | null = null;
  try {
    gps = kv.getItem(GPS_COUNTRY_KEY);
  } catch {}
  const zone = timeZone();
  return gps || (zone && ZONE_COUNTRY[zone]) || deviceLocale()?.regionCode?.toUpperCase() || null;
}

export function detectLanguage(): Lang {
  const country = guessCountry();
  if (country && ARABIC_COUNTRIES.has(country)) return 'ar';
  return deviceLocale()?.languageCode === 'ar' ? 'ar' : 'en';
}

/** Refresh the cached GPS country, only if location is already allowed. */
async function refreshGpsCountry(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted) return false;
    const pos =
      (await Location.getLastKnownPositionAsync({ maxAge: 24 * 3_600_000 })) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest }));
    if (!pos) return false;
    const [g] = await Location.reverseGeocodeAsync({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    });
    const code = g?.isoCountryCode?.toUpperCase();
    if (!code) return false;
    const before = kv.getItem(GPS_COUNTRY_KEY);
    kv.setItem(GPS_COUNTRY_KEY, code);
    return before !== code;
  } catch {
    return false;
  }
}

function resolve(): Lang {
  const pref = usePrefs.getState().language;
  return pref === 'auto' ? detectLanguage() : pref;
}

function apply() {
  const lang = resolve();
  if (useLangStore.getState().lang !== lang) useLangStore.setState({ lang });
  if (Platform.OS === 'web') {
    const doc = (globalThis as any).document;
    if (doc?.documentElement) {
      doc.documentElement.lang = lang;
      doc.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    }
  }
}

// Decide before the first render so the app never flashes the wrong language.
apply();
usePrefs.subscribe((s, prev) => {
  if (s.language !== prev.language) apply();
});

/** Mount once at the root: refines "Automatic" with GPS and on return to foreground. */
export function useLanguageSync() {
  useEffect(() => {
    const refine = () => {
      apply();
      void refreshGpsCountry().then((changed) => changed && apply());
    };
    refine();
    const sub = AppState.addEventListener('change', (st) => st === 'active' && refine());
    return () => sub.remove();
  }, []);
}
