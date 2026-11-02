import { queryStrings } from '../../i18n/query';
import { strings } from '../i18n';
import {
  addDays,
  addMonths,
  calendarDaysBetween,
  formatDate,
  monthLong,
  parseDayKey,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from '../time';
import type { RangeSpec } from './types';

export type ResolvedRange = {
  from: Date;
  /** exclusive */
  to: Date;
  /** "the last 30 days", "this week", "in March" — reads after a verb */
  label: string;
  /** short chip text */
  chip: string;
  /** true when the range is "everything" — from is the first event */
  allTime?: boolean;
};

export function resolveRange(spec: RangeSpec, now: Date, firstEvent?: Date | null): ResolvedRange {
  const S = strings(queryStrings);
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);

  if ('from' in spec) {
    const a = parseDayKey(spec.from) ?? today;
    const b = parseDayKey(spec.to) ?? today;
    const [from, toDay] = a <= b ? [a, b] : [b, a];
    const to = addDays(toDay, 1);
    // whole calendar month?
    if (from.getDate() === 1 && to.getDate() === 1 && addMonths(from, 1).getTime() === to.getTime()) {
      const name =
        monthLong(from.getMonth()) + (from.getFullYear() === now.getFullYear() ? '' : ` ${from.getFullYear()}`);
      return { from, to, label: S.inMonth(name), chip: name };
    }
    if (calendarDaysBetween(from, to) === 1) {
      const d = formatDate(from, now);
      return { from, to, label: S.onDay(d), chip: d };
    }
    const chip = `${formatDate(from, now)} – ${formatDate(toDay, now)}`;
    return { from, to, label: S.betweenDays(formatDate(from, now), formatDate(toDay, now)), chip };
  }

  switch (spec.preset) {
    case 'today':
      return { from: today, to: tomorrow, label: S.today, chip: S.todayChip };
    case 'yesterday':
      return { from: addDays(today, -1), to: today, label: S.yesterday, chip: S.yesterdayChip };
    case 'this_week':
      return { from: startOfWeek(now), to: addDays(startOfWeek(now), 7), label: S.thisWeek, chip: S.thisWeekChip };
    case 'last_week': {
      const w = startOfWeek(now);
      return { from: addDays(w, -7), to: w, label: S.lastWeek, chip: S.lastWeekChip };
    }
    case 'this_month':
      return { from: startOfMonth(now), to: addMonths(now, 1), label: S.thisMonth, chip: S.thisMonthChip };
    case 'last_month': {
      const m = startOfMonth(now);
      return { from: addMonths(m, -1), to: m, label: S.lastMonth, chip: S.lastMonthChip };
    }
    case 'this_year':
      return {
        from: startOfYear(now),
        to: new Date(now.getFullYear() + 1, 0, 1),
        label: S.thisYear,
        chip: String(now.getFullYear()),
      };
    case 'last_year':
      return {
        from: new Date(now.getFullYear() - 1, 0, 1),
        to: startOfYear(now),
        label: S.lastYear,
        chip: String(now.getFullYear() - 1),
      };
    case 'last_n_days': {
      const n = Math.max(1, Math.min(3650, Math.round(spec.n ?? 30)));
      if (n === 1) return { from: today, to: tomorrow, label: S.today, chip: S.todayChip };
      return { from: addDays(today, -(n - 1)), to: tomorrow, label: S.lastNDays(n), chip: S.lastNDaysChip(n) };
    }
    case 'all_time':
    default:
      return {
        from: firstEvent ? startOfDay(firstEvent) : today,
        to: tomorrow,
        label: S.soFar,
        chip: S.allTimeChip,
        allTime: true,
      };
  }
}

/** The period of equal length right before `r` — calendar-aware for weeks/months. */
export function previousRange(spec: RangeSpec, r: ResolvedRange, now: Date): ResolvedRange {
  const S = strings(queryStrings);
  if ('preset' in spec) {
    switch (spec.preset) {
      case 'today':
        return resolveRange({ preset: 'yesterday' }, now);
      case 'this_week':
        return resolveRange({ preset: 'last_week' }, now);
      case 'this_month':
        return resolveRange({ preset: 'last_month' }, now);
      case 'this_year':
        return resolveRange({ preset: 'last_year' }, now);
      case 'last_week': {
        const w = startOfWeek(now);
        return { from: addDays(w, -14), to: addDays(w, -7), label: S.weekBefore, chip: S.weekBeforeChip };
      }
      case 'last_month': {
        const m = startOfMonth(now);
        const from = addMonths(m, -2);
        return {
          from,
          to: addMonths(m, -1),
          label: S.inMonth(monthLong(from.getMonth())),
          chip: monthLong(from.getMonth()),
        };
      }
      default:
        break;
    }
  }
  const days = Math.max(1, calendarDaysBetween(r.from, r.to));
  const from = addDays(r.from, -days);
  return { from, to: r.from, label: S.daysBefore(days), chip: S.daysBeforeChip(days) };
}

/**
 * For "this week"/"this month", compare only the elapsed part of the previous
 * period so Monday morning isn't compared with a whole week.
 */
export function clipToElapsed(prev: ResolvedRange, current: ResolvedRange, now: Date): ResolvedRange {
  if (now >= current.to || now < current.from) return prev;
  const elapsed = now.getTime() - current.from.getTime();
  const to = new Date(Math.min(prev.to.getTime(), prev.from.getTime() + elapsed));
  return { ...prev, to };
}
