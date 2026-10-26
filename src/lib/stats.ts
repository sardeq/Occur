import type { OccurEvent } from './types';
import { DAY, addDays, addMonths, calendarDaysBetween, dayKey, startOfDay, startOfMonth, startOfWeek } from './time';

/** Pure stats over event lists. Input arrays are sorted ascending by time. */

export const ts = (e: OccurEvent) => Date.parse(e.occurredAt);

export function byCategory(events: OccurEvent[], categoryId: string): OccurEvent[] {
  return events.filter((e) => e.categoryId === categoryId);
}

export function inRange(events: OccurEvent[], from: Date | number, to: Date | number): OccurEvent[] {
  const a = typeof from === 'number' ? from : from.getTime();
  const b = typeof to === 'number' ? to : to.getTime();
  return events.filter((e) => {
    const t = ts(e);
    return t >= a && t < b;
  });
}

export function countBetween(events: OccurEvent[], from: Date | number, to: Date | number): number {
  return inRange(events, from, to).length;
}

export type PeriodStats = {
  today: number;
  week: number;
  month: number;
  /** same elapsed point of the previous period — a fair comparison mid-period */
  todayPrev: number;
  weekPrev: number;
  monthPrev: number;
  allTime: number;
  last: Date | null;
  first: Date | null;
};

export function periodStats(events: OccurEvent[], now: Date = new Date()): PeriodStats {
  const n = now.getTime();
  const d0 = startOfDay(now);
  const w0 = startOfWeek(now);
  const m0 = startOfMonth(now);

  const dPrev = addDays(d0, -1);
  const wPrev = addDays(w0, -7);
  const mPrev = addMonths(m0, -1);
  // elapsed time into the current period, clamped to the previous period's length
  const elapsedM = Math.min(n - m0.getTime(), m0.getTime() - mPrev.getTime());

  return {
    today: countBetween(events, d0, Infinity),
    week: countBetween(events, w0, Infinity),
    month: countBetween(events, m0, Infinity),
    todayPrev: countBetween(events, dPrev, dPrev.getTime() + (n - d0.getTime())),
    weekPrev: countBetween(events, wPrev, wPrev.getTime() + (n - w0.getTime())),
    monthPrev: countBetween(events, mPrev, mPrev.getTime() + elapsedM),
    allTime: events.length,
    last: events.length ? new Date(ts(events[events.length - 1])) : null,
    first: events.length ? new Date(ts(events[0])) : null,
  };
}

export function hourHistogram(events: OccurEvent[]): number[] {
  const bins = new Array(24).fill(0);
  for (const e of events) bins[new Date(ts(e)).getHours()]++;
  return bins;
}

/** index 0 = Sunday */
export function weekdayHistogram(events: OccurEvent[]): number[] {
  const bins = new Array(7).fill(0);
  for (const e of events) bins[new Date(ts(e)).getDay()]++;
  return bins;
}

export function countsByDay(events: OccurEvent[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of events) {
    const k = dayKey(new Date(ts(e)));
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

/** Counts for each of the last `days` calendar days, oldest first. */
export function dailySeries(events: OccurEvent[], days: number, now: Date = new Date()) {
  const map = countsByDay(events);
  const start = addDays(startOfDay(now), -(days - 1));
  return Array.from({ length: days }, (_, i) => {
    const d = addDays(start, i);
    return { date: d, count: map.get(dayKey(d)) ?? 0 };
  });
}

export function argmax(values: number[]): number {
  let best = -1;
  let idx = -1;
  values.forEach((v, i) => {
    if (v > best) {
      best = v;
      idx = i;
    }
  });
  return idx;
}

/**
 * The 3-hour window with the most events, as a centre hour. Smoother than the
 * single busiest hour, so "usually around 9 PM" doesn't jump around.
 */
export function typicalHour(events: OccurEvent[]): number | null {
  if (!events.length) return null;
  const h = hourHistogram(events);
  const smooth = h.map((_, i) => h[(i + 23) % 24] * 0.5 + h[i] + h[(i + 1) % 24] * 0.5);
  return argmax(smooth);
}

export type Streaks = { current: number; longest: number; longestEnd: Date | null };

/** Consecutive calendar days with at least one event. */
export function streaks(events: OccurEvent[], now: Date = new Date()): Streaks {
  if (!events.length) return { current: 0, longest: 0, longestEnd: null };
  const days = [...countsByDay(events).keys()].sort();
  let longest = 1;
  let longestEnd = days[0];
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1] + 'T00:00:00');
    const cur = new Date(days[i] + 'T00:00:00');
    run = calendarDaysBetween(prev, cur) === 1 ? run + 1 : 1;
    if (run >= longest) {
      longest = run;
      longestEnd = days[i];
    }
  }
  // current streak: counts back from today (or yesterday, so it doesn't reset at midnight)
  const set = new Set(days);
  let cursor = startOfDay(now);
  if (!set.has(dayKey(cursor))) cursor = addDays(cursor, -1);
  let current = 0;
  while (set.has(dayKey(cursor))) {
    current++;
    cursor = addDays(cursor, -1);
  }
  return { current, longest, longestEnd: new Date(longestEnd + 'T00:00:00') };
}

export type Gaps = {
  longestMs: number;
  longestFrom: Date | null;
  longestTo: Date | null;
  /** time since the last event */
  currentMs: number;
};

/** Longest stretch without the thing (including the ongoing one). */
export function gaps(events: OccurEvent[], now: Date = new Date()): Gaps {
  if (!events.length) return { longestMs: 0, longestFrom: null, longestTo: null, currentMs: 0 };
  let longestMs = 0;
  let longestFrom: Date | null = null;
  let longestTo: Date | null = null;
  for (let i = 1; i < events.length; i++) {
    const g = ts(events[i]) - ts(events[i - 1]);
    if (g > longestMs) {
      longestMs = g;
      longestFrom = new Date(ts(events[i - 1]));
      longestTo = new Date(ts(events[i]));
    }
  }
  const currentMs = now.getTime() - ts(events[events.length - 1]);
  if (currentMs > longestMs) {
    longestMs = currentMs;
    longestFrom = new Date(ts(events[events.length - 1]));
    longestTo = null; // still going
  }
  return { longestMs, longestFrom, longestTo, currentMs };
}

/**
 * How prominent a bubble should be on the home screen. Counts the last two
 * weeks *excluding today* so bubbles don't resize/reshuffle under your finger
 * while you tap; the layout settles once per day.
 */
export function usageWeight(events: OccurEvent[], now: Date = new Date()): number {
  const d0 = startOfDay(now).getTime();
  const from = d0 - 14 * DAY;
  let w = 0;
  for (const e of events) {
    const t = ts(e);
    if (t >= from && t < d0) w += 1;
  }
  return w;
}

/** Percentage change, or null when there is no baseline. */
export function pctChange(cur: number, prev: number): number | null {
  if (prev === 0) return cur === 0 ? 0 : null;
  return Math.round(((cur - prev) / prev) * 100);
}
