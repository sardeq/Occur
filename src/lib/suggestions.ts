import { getLang, type Lang } from './i18n';
import type { CategoryInput } from './store';

/**
 * Starter ideas shown on an empty home screen and in the "new bubble" sheet.
 * Names here are the stable English keys; show them through
 * `localSuggestions()` / `localizeSuggestion()` so they follow the app
 * language, and check "already added" with `isSuggestionUsed()` so an idea
 * added in one language isn't offered again in the other.
 */
export const SUGGESTIONS: CategoryInput[] = [
  { name: 'Coffee', emoji: '☕', color: 'apricot', goal: 'track', trackLocation: false },
  { name: 'Smoking', emoji: '🚬', color: 'slate', goal: 'less', trackLocation: false },
  { name: 'Water', emoji: '💧', color: 'sky', goal: 'more', trackLocation: false },
  { name: 'Workout', emoji: '🏋️', color: 'mint', goal: 'more', trackLocation: false },
  { name: 'Headache', emoji: '🤕', color: 'coral', goal: 'less', trackLocation: false },
  { name: 'Medication', emoji: '💊', color: 'rose', goal: 'track', trackLocation: false },
  { name: 'Reading', emoji: '📖', color: 'lilac', goal: 'more', trackLocation: false },
  { name: 'Eating out', emoji: '🍜', color: 'lime', goal: 'track', trackLocation: true },
  { name: 'Alcohol', emoji: '🍷', color: 'rose', goal: 'less', trackLocation: false },
  { name: 'Meditation', emoji: '🧘', color: 'lilac', goal: 'more', trackLocation: false },
  { name: 'Tea', emoji: '🍵', color: 'mint', goal: 'track', trackLocation: false },
  { name: 'Walk', emoji: '🚶', color: 'lime', goal: 'more', trackLocation: false },
  { name: 'Snack', emoji: '🍫', color: 'sand', goal: 'less', trackLocation: false },
  { name: 'Nap', emoji: '😴', color: 'sky', goal: 'track', trackLocation: false },
];

const NAMES_AR: Record<string, string> = {
  Coffee: 'قهوة',
  Smoking: 'تدخين',
  Water: 'ماء',
  Workout: 'تمرين',
  Headache: 'صداع',
  Medication: 'دواء',
  Reading: 'قراءة',
  'Eating out': 'أكل خارج البيت',
  Alcohol: 'كحول',
  Meditation: 'تأمل',
  Tea: 'شاي',
  Walk: 'مشي',
  Snack: 'وجبة خفيفة',
  Nap: 'قيلولة',
};
const EN_BY_AR = new Map(Object.entries(NAMES_AR).map(([en, ar]) => [ar, en]));

/** The English key of a starter idea, given its name in either language. */
const keyOf = (name: string) => EN_BY_AR.get(name) ?? name;

/** A starter idea with its name in `lang` (non-suggestions pass through unchanged). */
export function localizeSuggestion(s: CategoryInput, lang: Lang = getLang()): CategoryInput {
  const key = keyOf(s.name);
  const name = lang === 'ar' ? (NAMES_AR[key] ?? s.name) : key;
  return name === s.name ? s : { ...s, name };
}

/** All starter ideas, named in `lang`. */
export function localSuggestions(lang: Lang = getLang()): CategoryInput[] {
  return SUGGESTIONS.map((s) => localizeSuggestion(s, lang));
}

/** Lower-cased names this idea goes by, in every language. */
export function suggestionAliases(s: CategoryInput): string[] {
  const key = keyOf(s.name);
  return [key, NAMES_AR[key]].filter(Boolean).map((n) => n.toLowerCase());
}

/** True when a bubble with this idea's name (in any language) already exists. */
export function isSuggestionUsed(s: CategoryInput, usedLowerNames: Set<string>): boolean {
  return suggestionAliases(s).some((n) => usedLowerNames.has(n));
}

// prettier-ignore
export const EMOJIS = [
  '☕', '🚬', '💧', '🏋️', '🏃', '🚶', '🧘', '💊', '🤕', '😴', '📖', '✍️',
  '🍜', '🍕', '🍔', '🥗', '🍎', '🍫', '🍷', '🍺', '🥤', '🍵', '🧃', '🦷',
  '📱', '🎮', '📺', '🎧', '🎸', '🧹', '🛒', '💸', '🚗', '🚲', '✈️', '🐕',
  '💬', '📞', '❤️', '😤', '😊', '🌧️', '🌞', '🚿', '🪥', '🧴', '🌱', '⭐',
];
