/**
 * Sample data for the local demo mode (no backend needed). Deterministic
 * pseudo-random so screenshots and demos look the same every time.
 */
import type { Category, OccurEvent } from './types';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

type Pattern = {
  cat: Omit<Category, 'createdAt'>;
  /** typical hours, with weights */
  hours: [number, number][];
  perDay: [number, number];
  /** probability of skipping a day */
  skip: number;
  weekendBoost?: number;
};

const PATTERNS: Pattern[] = [
  {
    cat: { id: 'demo-coffee', name: 'Coffee', emoji: '☕', color: 'apricot', goal: 'track', trackLocation: false },
    hours: [
      [8, 5],
      [11, 3],
      [15, 2],
      [17, 1],
    ],
    perDay: [1, 4],
    skip: 0.04,
  },
  {
    cat: { id: 'demo-smoke', name: 'Smoking', emoji: '🚬', color: 'slate', goal: 'less', trackLocation: true },
    hours: [
      [9, 2],
      [13, 2],
      [18, 2],
      [21, 4],
      [23, 2],
    ],
    perDay: [2, 7],
    skip: 0.12,
    weekendBoost: 1.5,
  },
  {
    cat: { id: 'demo-water', name: 'Water', emoji: '💧', color: 'sky', goal: 'more', trackLocation: false },
    hours: [
      [8, 2],
      [10, 2],
      [12, 3],
      [14, 2],
      [16, 2],
      [19, 2],
    ],
    perDay: [3, 8],
    skip: 0.02,
  },
  {
    cat: { id: 'demo-workout', name: 'Workout', emoji: '🏋️', color: 'mint', goal: 'more', trackLocation: true },
    hours: [
      [7, 2],
      [18, 3],
    ],
    perDay: [1, 1],
    skip: 0.55,
  },
  {
    cat: { id: 'demo-read', name: 'Reading', emoji: '📖', color: 'lilac', goal: 'more', trackLocation: false },
    hours: [
      [22, 4],
      [13, 1],
    ],
    perDay: [1, 2],
    skip: 0.4,
  },
  {
    cat: { id: 'demo-headache', name: 'Headache', emoji: '🤕', color: 'coral', goal: 'less', trackLocation: false },
    hours: [
      [15, 2],
      [19, 1],
    ],
    perDay: [1, 1],
    skip: 0.86,
  },
];

function pickHour(r: () => number, hours: [number, number][]): number {
  const total = hours.reduce((a, [, w]) => a + w, 0);
  let x = r() * total;
  for (const [h, w] of hours) {
    x -= w;
    if (x <= 0) return h;
  }
  return hours[0][0];
}

export function demoSeed(now: Date = new Date(), days = 120): { categories: Category[]; events: OccurEvent[] } {
  const r = rng(42);
  const created = new Date(now);
  created.setDate(created.getDate() - days);
  const categories: Category[] = PATTERNS.map((p) => ({ ...p.cat, createdAt: created.toISOString() }));
  const events: OccurEvent[] = [];
  let n = 0;
  for (const p of PATTERNS) {
    for (let i = days; i >= 0; i--) {
      if (r() < p.skip) continue;
      const day = new Date(now);
      day.setDate(day.getDate() - i);
      const weekend = day.getDay() === 0 || day.getDay() === 6;
      const [lo, hi] = p.perDay;
      let count = lo + Math.floor(r() * (hi - lo + 1));
      if (weekend && p.weekendBoost) count = Math.round(count * p.weekendBoost);
      // gently trending down for "less" goals so the insights have a story
      if (p.cat.goal === 'less' && i < 30) count = Math.max(lo, count - 1);
      for (let k = 0; k < count; k++) {
        const d = new Date(day);
        const jitter = r() < 0.35 ? (r() < 0.5 ? -1 : 1) : 0;
        d.setHours(
          Math.min(23, Math.max(0, pickHour(r, p.hours) + jitter)),
          Math.floor(r() * 60),
          Math.floor(r() * 60),
          0,
        );
        if (d > now) continue;
        events.push({
          id: `demo-e${n++}`,
          categoryId: p.cat.id,
          occurredAt: d.toISOString(),
          tz: null,
          source: 'tap',
          place: p.cat.trackLocation ? (r() < 0.6 ? 'Rainbow St, Jabal Amman' : 'Abdali Boulevard') : null,
        });
      }
    }
  }
  events.sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
  return { categories, events };
}
