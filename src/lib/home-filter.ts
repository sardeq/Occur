import { argmax, hourHistogram, pctChange, streaks, ts, typicalHour, weekdayHistogram } from './stats';
import {
  DAY,
  MONTHS_SHORT,
  WEEKDAYS_LONG,
  WEEKDAYS_SHORT,
  addDays,
  addMonths,
  calendarDaysBetween,
  dayKey,
  formatDuration,
  formatHour,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from './time';
import type { Category, Goal, OccurEvent } from './types';

/**
 * The home-screen filter bar: which period the bubbles count over, an optional
 * "lens" (top / quiet / goal) and an optional set of hand-picked categories.
 * Pure helpers only — the UI lives in components/filter-bar.tsx.
 */

export type HomeRange = 'today' | 'week' | 'month' | 'year';
export type Lens = 'top' | 'quiet' | 'more' | 'less';

export const RANGES: { key: HomeRange; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
];

/** "today" / "this week" … */
export function rangeWord(r: HomeRange): string {
  return r === 'today' ? 'today' : `this ${r}`;
}

/** "vs yesterday" / "vs last week" … */
export function prevWord(r: HomeRange): string {
  return r === 'today' ? 'vs yesterday' : `vs last ${r}`;
}

export const TOP_N = 3;

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

/** Calendar days covered so far, today counting as a whole day. */
export function daysSoFar(range: HomeRange, now: Date): number {
  return calendarDaysBetween(new Date(rangeBounds(range, now).start), now) + 1;
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

/** Which categories the bubbles/list should show, in display order. */
export function applyFilter(
  categories: Category[],
  byCat: Record<string, CatStat>,
  lens: Lens | null,
  picked: string[],
): Category[] {
  if (picked.length) return categories.filter((c) => picked.includes(c.id));
  if (!lens) return categories;
  if (lens === 'more' || lens === 'less') return categories.filter((c) => c.goal === lens);
  if (lens === 'top')
    return categories
      .filter((c) => statFor(byCat, c.id).count > 0)
      .sort((a, b) => statFor(byCat, b.id).count - statFor(byCat, a.id).count)
      .slice(0, TOP_N);
  // quiet: nothing logged in the period, longest-silent first
  return categories
    .filter((c) => statFor(byCat, c.id).count === 0)
    .sort((a, b) => (statFor(byCat, a.id).last ?? 0) - (statFor(byCat, b.id).last ?? 0));
}

export function goalsInUse(categories: Category[]): Record<Goal, boolean> {
  return {
    track: categories.some((c) => c.goal === 'track'),
    more: categories.some((c) => c.goal === 'more'),
    less: categories.some((c) => c.goal === 'less'),
  };
}

/** 2.83 → "2.8", 3.0 → "3", 14.6 → "15" */
export function fmtRate(x: number): string {
  if (!Number.isFinite(x)) return '0';
  if (x >= 10) return String(Math.round(x));
  return x.toFixed(1).replace(/\.0$/, '');
}

/** Short "time since" for a bubble face: "45m", "5h", "3d", "2w". */
export function sinceShort(ms: number): string {
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${Math.max(1, m)}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 14) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 9) return `${w}w`;
  return `${Math.floor(d / 30)}mo`;
}

/** Bars for the focused category, shaped to the period. */
export function rangeSeries(events: OccurEvent[], range: HomeRange, now: Date) {
  const days = new Map<string, number>();
  for (const e of events) {
    const k = dayKey(new Date(ts(e)));
    days.set(k, (days.get(k) ?? 0) + 1);
  }
  const at = (d: Date) => days.get(dayKey(d)) ?? 0;

  if (range === 'today' || range === 'week') {
    const first = range === 'today' ? addDays(startOfDay(now), -6) : startOfWeek(now);
    const ds = Array.from({ length: 7 }, (_, i) => addDays(first, i));
    return {
      values: ds.map(at),
      labels: ds.map((d) => WEEKDAYS_SHORT[d.getDay()].slice(0, 1)),
      highlight: range === 'today' ? 6 : calendarDaysBetween(first, now),
    };
  }
  if (range === 'month') {
    const first = startOfMonth(now);
    const len = calendarDaysBetween(first, addMonths(first, 1));
    const ds = Array.from({ length: len }, (_, i) => addDays(first, i));
    return {
      values: ds.map(at),
      labels: ds.map((d) => (d.getDate() === 1 || d.getDate() % 7 === 0 ? String(d.getDate()) : '')),
      highlight: now.getDate() - 1,
    };
  }
  const months = new Array(12).fill(0);
  const y = now.getFullYear();
  for (const e of events) {
    const d = new Date(ts(e));
    if (d.getFullYear() === y) months[d.getMonth()]++;
  }
  return { values: months, labels: MONTHS_SHORT.map((m) => m.slice(0, 1)), highlight: now.getMonth() };
}

export type Tile = { value: string; label: string; tone?: 'good' | 'bad' };

/**
 * The little stat tiles for one category: pace, per-day / per-week rates,
 * usual time, time since last, streak, best day. Only the ones that say
 * something are returned.
 */
export function focusTiles(
  events: OccurEvent[],
  category: Category,
  stat: CatStat,
  range: HomeRange,
  now: Date,
): Tile[] {
  const out: Tile[] = [];
  const n = now.getTime();
  const d0 = startOfDay(now).getTime();

  // pace vs the previous period
  if (stat.count || stat.prev) {
    const pct = pctChange(stat.count, stat.prev);
    const value = pct === null ? `+${stat.count}` : pct === 0 ? 'Same' : `${pct > 0 ? '↑' : '↓'} ${Math.abs(pct)}%`;
    const up = pct === null || pct > 0;
    const tone =
      pct === 0 || category.goal === 'track'
        ? undefined
        : (category.goal === 'more') === up
          ? ('good' as const)
          : ('bad' as const);
    out.push({ value, label: prevWord(range), tone });
  }

  // rates — "lately" = the 28 days before today, so it doesn't move as you tap
  let lately = 0;
  let firstTs: number | null = null;
  for (const e of events) {
    const t = ts(e);
    if (firstTs === null) firstTs = t;
    if (t >= d0 - 28 * DAY && t < d0) lately++;
  }
  // don't average over days before the category existed
  const spanDays =
    firstTs === null ? 0 : Math.min(28, Math.max(1, Math.round((d0 - startOfDay(new Date(firstTs)).getTime()) / DAY)));
  if (range === 'today') {
    if (spanDays && lately) out.push({ value: fmtRate(lately / spanDays), label: 'a day, usually' });
  } else {
    out.push({ value: fmtRate(stat.count / daysSoFar(range, now)), label: `a day ${rangeWord(range)}` });
  }
  if (spanDays >= 7 && lately && range !== 'week') {
    out.push({ value: fmtRate((lately / spanDays) * 7), label: 'a week, usually' });
  }

  // when
  const recent = events.filter((e) => ts(e) >= d0 - 60 * DAY);
  const hour = recent.length >= 3 ? typicalHour(recent) : null;
  if (hour !== null) out.push({ value: `~${formatHour(hour)}`, label: 'usually' });
  if (stat.last !== null) {
    out.push({
      value: formatDuration(n - stat.last),
      label: category.goal === 'less' ? 'since the last one' : 'since last',
      tone: category.goal === 'less' && n - stat.last > DAY ? 'good' : undefined,
    });
  }

  // streak + best day
  if (category.goal !== 'less') {
    const s = streaks(events, now);
    if (s.current >= 2) out.push({ value: `${s.current} days`, label: 'streak' });
  }
  if (range !== 'today') {
    const { start } = rangeBounds(range, now);
    const perDay = new Map<string, number>();
    for (const e of events) {
      if (ts(e) < start) continue;
      const k = dayKey(new Date(ts(e)));
      perDay.set(k, (perDay.get(k) ?? 0) + 1);
    }
    let bestK = '';
    let best = 0;
    perDay.forEach((v, k) => {
      if (v > best) {
        best = v;
        bestK = k;
      }
    });
    // only worth a tile when one day actually stood out
    const avg = stat.count / daysSoFar(range, now);
    if (best > 1 && best >= avg * 1.25) {
      const d = new Date(bestK + 'T00:00:00');
      out.push({
        value: String(best),
        label: `${category.goal === 'less' ? 'peak' : 'best'} day (${WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()})`,
      });
    }
  }
  return out;
}

/**
 * One line that says something about a mix of categories: a ratio when two are
 * picked ("2.5 💧 for every ☕"), otherwise rate + busiest day/hour.
 */
export function mixLine(
  items: { category: Category; count: number }[],
  events: OccurEvent[],
  range: HomeRange,
  now: Date,
): string | null {
  const live = items.filter((i) => i.count > 0);
  if (!live.length) return null;
  if (items.length === 2 && live.length === 2) {
    const [a, b] = [...live].sort((x, y) => x.count - y.count);
    if (b.count / a.count < 1.1)
      return `Neck and neck — ${a.category.emoji} ${a.count} · ${b.category.emoji} ${b.count}`;
    return `${fmtRate(b.count / a.count)} ${b.category.emoji} for every ${a.category.emoji}`;
  }
  const total = live.reduce((s, i) => s + i.count, 0);
  const ids = new Set(items.map((i) => i.category.id));
  const { start } = rangeBounds(range, now);
  const inRange = events.filter((e) => ids.has(e.categoryId) && ts(e) >= start);
  if (range === 'today') {
    const h = argmax(hourHistogram(inRange));
    return total > 1 && h >= 0 ? `Busiest around ${formatHour(h)}` : null;
  }
  const parts = [`${fmtRate(total / daysSoFar(range, now))} a day`];
  if (range !== 'week' || daysSoFar(range, now) > 2) {
    const wd = argmax(weekdayHistogram(inRange));
    if (wd >= 0 && total > 2) parts.push(`busiest on ${WEEKDAYS_LONG[wd]}s`);
  }
  return parts.join(' · ');
}

/** For the quiet lens: the longest-silent thing, phrased gently. */
export function quietLine(items: { category: Category; last: number | null }[], now: Date): string | null {
  if (!items.length) return null;
  const q = items[0];
  if (q.last === null) return `${q.category.emoji} ${q.category.name} hasn't had its first one yet`;
  return `${q.category.emoji} ${q.category.name} — last one ${formatDuration(now.getTime() - q.last)} ago`;
}
