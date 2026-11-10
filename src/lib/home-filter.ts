import { homeFilterStrings } from '../i18n/home-filter';
import { strings, type Lang } from './i18n';
import { ts } from './stats';
import { addDays, addMonths, startOfDay, startOfMonth, startOfWeek, startOfYear } from './time';
import type { OccurEvent } from './types';

/**
 * The home-screen period switch: which period the bubbles count over.
 * Pure helpers only — the UI lives in components/filter-bar.tsx. Text follows
 * the language passed in, so callers memoising results should depend on it.
 */

const S = (lang?: Lang) => strings(homeFilterStrings, lang);

export type HomeRange = 'today' | 'week' | 'month' | 'year';

export const RANGE_KEYS: HomeRange[] = ['today', 'week', 'month', 'year'];

/** Day · Week · Month · Year, in `lang`. */
export function ranges(lang?: Lang): { key: HomeRange; label: string }[] {
  const s = S(lang);
  return RANGE_KEYS.map((key) => ({ key, label: s.range[key] }));
}

/** "Today" / "This week" … — the home screen headline. */
export function rangeTitle(r: HomeRange, lang?: Lang): string {
  return S(lang).title[r];
}

/** "today" / "this week" … */
export function rangeWord(r: HomeRange, lang?: Lang): string {
  return S(lang).rangeWord(r);
}

/**
 * Start of the current period, and the previous period cut off at the same
 * elapsed point — so Wednesday morning compares against last Wednesday morning,
 * not the whole of last week.
 */
export function rangeBounds(range: HomeRange, now: Date) {
  const n = now.getTime();
  let start: Date;
  let prevStart: Date;
  if (range === 'today') {
    start = startOfDay(now);
    prevStart = addDays(start, -1);
  } else if (range === 'week') {
    start = startOfWeek(now);
    prevStart = addDays(start, -7);
  } else if (range === 'month') {
    start = startOfMonth(now);
    prevStart = addMonths(start, -1);
  } else {
    start = startOfYear(now);
    prevStart = new Date(start.getFullYear() - 1, 0, 1);
  }
  const elapsed = Math.min(n - start.getTime(), start.getTime() - prevStart.getTime());
  return { start: start.getTime(), prevStart: prevStart.getTime(), prevEnd: prevStart.getTime() + elapsed };
}

export type CatStat = {
  /** in the selected period */
  count: number;
  /** previous period, same elapsed point */
  prev: number;
  /** in the selected period but before today — stable during the day, used for bubble size */
  before: number;
  today: number;
  /** last event ever, ms */
  last: number | null;
};

const empty = (): CatStat => ({ count: 0, prev: 0, before: 0, today: 0, last: null });

/** One pass over the (time-sorted) log. */
export function summarize(events: OccurEvent[], range: HomeRange, now: Date) {
  const { start, prevStart, prevEnd } = rangeBounds(range, now);
  const d0 = startOfDay(now).getTime();
  const byCat: Record<string, CatStat> = {};
  for (const e of events) {
    const t = ts(e);
    const s = (byCat[e.categoryId] ??= empty());
    if (t >= start) {
      s.count++;
      if (t < d0) s.before++;
    } else if (t >= prevStart && t < prevEnd) s.prev++;
    if (t >= d0) s.today++;
    if (s.last === null || t > s.last) s.last = t;
  }
  return byCat;
}

export const statFor = (byCat: Record<string, CatStat>, id: string) => byCat[id] ?? empty();
