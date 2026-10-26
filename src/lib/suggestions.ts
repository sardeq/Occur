import type { CategoryInput } from './store';

/** Starter ideas shown on an empty home screen and in the "new bubble" sheet. */
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
];

// prettier-ignore
export const EMOJIS = [
  '☕', '🚬', '💧', '🏋️', '🏃', '🚶', '🧘', '💊', '🤕', '😴', '📖', '✍️',
  '🍜', '🍕', '🍔', '🥗', '🍎', '🍫', '🍷', '🍺', '🥤', '🍵', '🧃', '🦷',
  '📱', '🎮', '📺', '🎧', '🎸', '🧹', '🛒', '💸', '🚗', '🚲', '✈️', '🐕',
  '💬', '📞', '❤️', '😤', '😊', '🌧️', '🌞', '🚿', '🪥', '🧴', '🌱', '⭐',
];
