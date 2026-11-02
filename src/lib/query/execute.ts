/**
 * Deterministic executor: QuerySpec + events → Answer.
 * This is the only place numbers in answers come from.
 */
import { queryStrings } from '../../i18n/query';
import { getLang, strings } from '../i18n';
import {
  argmax,
  countsByDay,
  gaps,
  hourHistogram,
  inRange,
  pctChange,
  streaks,
  ts,
  typicalHour,
  weekdayHistogram,
} from '../stats';
import {
  DAY,
  MONTHS_SHORT,
  addDays,
  calendarDaysBetween,
  dayKey,
  formatDate,
  formatDayLabel,
  formatDuration,
  formatHour,
  formatHourCompact,
  formatRelative,
  formatTime,
  monthLong,
  monthShort,
  parseDayKey,
  startOfDay,
  startOfWeek,
  weekdayInitial,
  weekdayLong,
} from '../time';
import type { Category, OccurEvent } from '../types';
import { clipToElapsed, previousRange, resolveRange, type ResolvedRange } from './resolve';
import type { Answer, AnswerChart, QueryFilter, QuerySpec } from './types';

type Ctx = {
  categories: Category[];
  events: OccurEvent[];
  now?: Date;
  source?: Answer['source'];
};

const fmt = (x: number) => (x >= 10 ? String(Math.round(x)) : String(Math.round(x * 10) / 10));

function matchesFilter(e: OccurEvent, f?: QueryFilter): boolean {
  if (!f) return true;
  const d = new Date(ts(e));
  if (f.weekdays?.length && !f.weekdays.includes(d.getDay())) return false;
  if (f.hourFrom !== undefined || f.hourTo !== undefined) {
    const from = f.hourFrom ?? 0;
    const to = f.hourTo ?? 24;
    const h = d.getHours();
    const ok = from <= to ? h >= from && h < to : h >= from || h < to;
    if (!ok) return false;
  }
  return true;
}

export function describeFilter(f?: QueryFilter): string {
  if (!f) return '';
  const S = strings(queryStrings);
  const parts: string[] = [];
  if (f.weekdays?.length) {
    const w = [...f.weekdays].sort();
    if (w.join() === '0,6') parts.push(S.onWeekends);
    else if (w.join() === '1,2,3,4,5') parts.push(S.onWeekdays);
    else parts.push(S.onDays(w.map(weekdayLong)));
  }
  if (f.hourFrom !== undefined || f.hourTo !== undefined) {
    const a = f.hourFrom ?? 0;
    const b = f.hourTo ?? 24;
    const key = `${a}-${b}`;
    const named: Record<string, string> = {
      '5-12': S.morning,
      '12-17': S.afternoon,
      '17-22': S.evening,
      '22-5': S.night,
    };
    if (named[key]) parts.push(named[key]);
    else if (b === 24) parts.push(S.after(formatHour(a)));
    else if (a === 0) parts.push(S.before(formatHour(b)));
    else parts.push(S.between(formatHour(a), formatHour(b)));
  }
  return parts.join(' ');
}

/** days in a range that have already happened (for averages) */
function elapsedDays(r: ResolvedRange, now: Date): number {
  const end = Math.min(r.to.getTime(), addDays(startOfDay(now), 1).getTime());
  return Math.max(1, Math.round((end - r.from.getTime()) / DAY));
}

function monthlyChart(events: OccurEvent[], r: ResolvedRange, now: Date, color?: string): AnswerChart {
  const values: number[] = [];
  const labels: string[] = [];
  const start = new Date(r.from.getFullYear(), r.from.getMonth(), 1);
  const endMs = Math.min(r.to.getTime(), now.getTime());
  const months: Date[] = [];
  for (let d = start; d.getTime() < endMs; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) months.push(d);
  const slice = months.slice(-12);
  for (const m of slice) {
    const next = new Date(m.getFullYear(), m.getMonth() + 1, 1);
    values.push(inRange(events, m, next).length);
    // Arabic month names share initials, so number the months instead
    labels.push(getLang() === 'ar' ? String(m.getMonth() + 1) : MONTHS_SHORT[m.getMonth()].slice(0, 1));
  }
  return { kind: 'bars', values, labels, highlight: argmax(values), color };
}

function dailyChart(events: OccurEvent[], r: ResolvedRange, now: Date, color?: string): AnswerChart {
  const days = Math.min(elapsedDays(r, now), 31);
  const map = countsByDay(events);
  const values: number[] = [];
  const labels: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(r.from, i);
    values.push(map.get(dayKey(d)) ?? 0);
    labels.push(days <= 7 ? weekdayInitial(d.getDay()) : i % 5 === 0 ? String(d.getDate()) : '');
  }
  return { kind: 'bars', values, labels, highlight: argmax(values), color };
}

/** Monday-first weekday chart */
function weekdayChart(events: OccurEvent[], color?: string): AnswerChart {
  const h = weekdayHistogram(events);
  const order = [1, 2, 3, 4, 5, 6, 0];
  const values = order.map((i) => h[i]);
  return {
    kind: 'weekday',
    values,
    labels: order.map(weekdayInitial),
    highlight: argmax(values),
    color,
  };
}

function hourChart(events: OccurEvent[], color?: string): AnswerChart {
  const values = hourHistogram(events);
  return {
    kind: 'hour',
    values,
    labels: values.map((_, i) => (i % 6 === 0 ? formatHourCompact(i) : '')),
    highlight: argmax(values),
    color,
  };
}

export function executeQuery(spec: QuerySpec, ctx: Ctx): Answer {
  const now = ctx.now ?? new Date();
  const source = ctx.source ?? 'device';
  const byId = new Map(ctx.categories.map((c) => [c.id, c]));
  const selected = spec.categoryIds.map((id) => byId.get(id)).filter((c): c is Category => !!c);
  const all = selected.length === 0;
  const cats = all ? ctx.categories : selected;
  const catIds = new Set(cats.map((c) => c.id));
  const single = selected.length === 1 ? selected[0] : null;
  const color = single?.color;
  const S = strings(queryStrings);
  const times = S.times;
  const cap = S.cap;

  const subject = single
    ? single.name
    : all
      ? S.subjectAll
      : selected.length === 2
        ? S.subjectTwo(selected[0].name, selected[1].name)
        : S.subjectMany(selected.length);
  const subjectChip = single
    ? `${single.emoji} ${single.name}`
    : all
      ? S.allCategories
      : selected.map((c) => c.emoji).join(' ');

  const base = (partial: Omit<Answer, 'interpretation' | 'source' | 'spec'>, extraChips: string[] = []): Answer => ({
    ...partial,
    interpretation: [subjectChip, ...extraChips].filter(Boolean),
    source,
    spec,
  });

  // asked about something the user doesn't track
  if (spec.unmatched && all) {
    const names = ctx.categories.slice(0, 6).map((c) => `${c.emoji} ${c.name}`);
    return {
      headline: '—',
      caption: S.noMatchCaption,
      sentence: S.noMatch(spec.unmatched, names),
      interpretation: [S.quoted(spec.unmatched)],
      source,
      spec,
    };
  }

  const scoped = ctx.events.filter((e) => catIds.has(e.categoryId) && matchesFilter(e, spec.filter));
  const first = scoped.length ? new Date(ts(scoped[0])) : null;
  const r = resolveRange(spec.range, now, first);
  const inR = inRange(scoped, r.from, r.to);
  const filterText = describeFilter(spec.filter);
  const ft = filterText ? ` ${filterText}` : '';
  const chips = [r.chip, filterText ? filterText[0].toUpperCase() + filterText.slice(1) : ''];

  if (!ctx.categories.length) {
    return base({
      headline: '0',
      caption: S.nothingYetCaption,
      sentence: S.notCounting,
    });
  }

  const nothing = (what: string) =>
    base(
      {
        headline: '0',
        caption: S.timesCaption(0),
        sentence: S.nothing(what, r.label, ft, !!r.allTime),
      },
      chips,
    );

  switch (spec.intent) {
    case 'count': {
      const n = inR.length;
      const days = elapsedDays(r, now);
      let sentence: string;
      let chart: AnswerChart | undefined;
      if (single) {
        sentence = S.loggedTimes(single.name, n, r.label, ft);
        if (n > 0 && days > 1) sentence += S.aboutPerDay(fmt(n / days));
        if (days > 1) chart = days <= 31 ? dailyChart(inR, r, now, color) : monthlyChart(inR, r, now, color);
      } else {
        const counts = cats
          .map((c) => ({ c, n: inR.filter((e) => e.categoryId === c.id).length }))
          .filter((x) => x.n > 0)
          .sort((a, b) => b.n - a.n);
        sentence = all ? S.moments(n, r.label, ft, counts.length) : S.loggedTimes(subject, n, r.label, ft);
        if (counts.length) {
          sentence += S.mostOf(counts[0].c.name, counts[0].n);
          chart = {
            kind: 'bars',
            values: counts.slice(0, 7).map((x) => x.n),
            labels: counts.slice(0, 7).map((x) => x.c.emoji),
            highlight: 0,
          };
        }
      }
      return base({ headline: String(n), caption: S.timesCaption(n), sentence, chart }, [...chips, S.countChip]);
    }

    case 'peak': {
      if (!inR.length) return nothing(subject);
      const n = inR.length;
      switch (spec.groupBy) {
        case 'hour': {
          const h = hourHistogram(inR);
          const i = argmax(h);
          return base(
            {
              headline: formatHour(i),
              caption: S.kOfN(h[i], n),
              sentence: S.peakHour(cap(subject), formatHour(i), formatHour(i + 1), h[i], n, r.label, ft),
              chart: hourChart(inR, color),
            },
            [...chips, S.byHour],
          );
        }
        case 'weekday': {
          const h = weekdayHistogram(inR);
          const i = argmax(h);
          return base(
            {
              headline: S.weekdayPlural(weekdayLong(i)),
              caption: S.kOfN(h[i], n),
              sentence: S.peakWeekday(weekdayLong(i), subject, h[i], n, r.label, ft),
              chart: weekdayChart(inR, color),
            },
            [...chips, S.byWeekday],
          );
        }
        case 'week': {
          const m = new Map<string, number>();
          for (const e of inR) {
            const k = dayKey(startOfWeek(new Date(ts(e))));
            m.set(k, (m.get(k) ?? 0) + 1);
          }
          const [k, c] = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
          const d = parseDayKey(k)!;
          return base(
            {
              headline: S.weekOf(d.getDate(), monthShort(d.getMonth())),
              caption: times(c),
              sentence: S.peakWeek(subject, formatDate(d, now), c),
            },
            [...chips, S.byWeek],
          );
        }
        case 'month': {
          const m = new Map<string, number>();
          for (const e of inR) {
            const d = new Date(ts(e));
            const k = `${d.getFullYear()}-${d.getMonth()}`;
            m.set(k, (m.get(k) ?? 0) + 1);
          }
          const [k, c] = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
          const [y, mo] = k.split('-').map(Number);
          return base(
            {
              headline: `${monthLong(mo)}${y === now.getFullYear() ? '' : ` ${y}`}`,
              caption: times(c),
              sentence: S.peakMonth(monthLong(mo), y, subject, c),
              chart: monthlyChart(inR, r, now, color),
            },
            [...chips, S.byMonth],
          );
        }
        case 'day':
        default: {
          const days = [...countsByDay(inR).entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? 1 : -1));
          const [k, c] = days[0];
          const d = parseDayKey(k)!;
          if (spec.groupBy === 'day') {
            return base(
              {
                headline: formatDate(d, now),
                caption: times(c),
                sentence: S.peakDay(
                  subject,
                  calendarDaysBetween(d, now) === 0 ? 'today' : null,
                  formatDate(d, now),
                  c,
                  ft,
                ),
                chart: dailyChart(inR, r, now, color),
              },
              [...chips, S.byDay],
            );
          }
          // no grouping asked: give the full picture — usual hour, busiest weekday, heaviest day
          const hour = typicalHour(inR)!;
          const wd = weekdayHistogram(inR);
          const wi = argmax(wd);
          return base(
            {
              headline: `~${formatHour(hour)}`,
              caption: S.usualCaption,
              sentence: S.usual(cap(subject), formatHour(hour), weekdayLong(wi), wd[wi], n, formatDate(d, now), c),
              chart: hourChart(inR, color),
            },
            [...chips, S.peakChip],
          );
        }
      }
    }

    case 'last':
    case 'first': {
      if (!inR.length) return nothing(subject);
      const e = spec.intent === 'last' ? inR[inR.length - 1] : inR[0];
      const d = new Date(ts(e));
      const cat = byId.get(e.categoryId);
      const what = single ? single.name : `${cat?.emoji ?? ''} ${cat?.name ?? S.entry}`.trim();
      const day = formatDayLabel(d, now);
      const where = e.place ? S.near(e.place) : '';
      const ago = calendarDaysBetween(d, now);
      const recentDay = ago === 0 || ago === 1 ? day : null;
      const sentence =
        spec.intent === 'last'
          ? S.last(
              all,
              what,
              recentDay,
              formatDate(d, now),
              formatTime(d),
              where,
              formatDuration(now.getTime() - d.getTime()),
            )
          : S.first(all, what, formatDate(d, now), formatTime(d), where, inR.length);
      return base(
        {
          headline: spec.intent === 'last' ? formatRelative(d, now) : formatDate(d, now),
          caption: `${formatDate(d, now)} · ${formatTime(d)}`,
          sentence,
        },
        [...chips, spec.intent === 'last' ? S.mostRecentChip : S.firstChip],
      );
    }

    case 'average': {
      const per = spec.per ?? 'day';
      const days = elapsedDays(r, now);
      const units = per === 'day' ? days : per === 'week' ? days / 7 : days / 30.44;
      const value = inR.length / Math.max(units, 1);
      return base(
        {
          headline: fmt(value),
          caption: S.perCaption(per),
          sentence: S.average(all, subject, fmt(value), per, r.label, ft, inR.length, days),
          chart: days > 1 && days <= 31 ? dailyChart(inR, r, now, color) : undefined,
        },
        [...chips, S.perChip(per)],
      );
    }

    case 'compare': {
      let prev = spec.compareTo ? resolveRange(spec.compareTo, now, first) : previousRange(spec.range, r, now);
      let prevLabel = prev.label;
      // mid-period: compare like with like (Monday 9am vs last Monday 9am, not a whole week)
      if (now >= r.from && now < r.to && prev.to <= r.from) {
        prev = clipToElapsed(prev, r, now);
        prevLabel = S.byThisPoint(prev.label);
      }
      const a = inR.length;
      const b = inRange(scoped, prev.from, prev.to).length;
      const pct = pctChange(a, b);
      const diff = a - b;
      const trend = diff === 0 ? S.same : S.trend(diff, pct);
      return base(
        {
          headline: S.vs(a, b),
          caption: pct === null ? S.newCaption : `${pct > 0 ? '+' : ''}${pct}%`,
          sentence: S.compare(cap(subject), a, r.label, b, prevLabel, ft, trend),
          chart: { kind: 'bars', values: [b, a], labels: [prev.chip, r.chip], highlight: 1, color },
        },
        [r.chip, S.vsChip(prev.chip), S.compareChip],
      );
    }

    case 'streak': {
      if (!inR.length) return nothing(subject);
      const s = streaks(inR, now);
      return base(
        {
          headline: S.daysHeadline(s.longest),
          caption: S.streakCaption,
          sentence: S.streak(subject, s.longest, s.longestEnd ? formatDate(s.longestEnd, now) : null, s.current),
        },
        [...chips, S.streakChip],
      );
    }

    case 'gap': {
      if (!inR.length) return nothing(subject);
      const g = gaps(inR, now);
      const ongoing = g.longestTo === null;
      const sentence = ongoing
        ? S.gapNow(subject, formatDuration(g.longestMs), formatDate(g.longestFrom!, now), formatTime(g.longestFrom!))
        : S.gapPast(
            subject,
            formatDuration(g.longestMs),
            formatDate(g.longestFrom!, now),
            formatDate(g.longestTo!, now),
            formatDuration(g.currentMs),
          );
      return base(
        { headline: formatDuration(g.longestMs), caption: ongoing ? S.andCounting : S.longestBreak, sentence },
        [...chips, S.gapChip],
      );
    }

    case 'list': {
      const n = inR.length;
      if (!n) return nothing(subject);
      const groups = new Map<string, Date[]>();
      for (const e of [...inR].reverse()) {
        const d = new Date(ts(e));
        const k = formatDayLabel(d, now);
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k)!.push(d);
      }
      const shown = [...groups.entries()].slice(0, 5);
      const body = shown
        .map(([k, ds]) => `${k}: ${ds.slice(0, 8).map(formatTime).join(S.listSep)}${ds.length > 8 ? '…' : ''}`)
        .join(' · ');
      const more = groups.size > shown.length ? S.moreDays(groups.size - shown.length) : '';
      return base(
        {
          headline: String(n),
          caption: S.timesCaption(n),
          sentence: `${body}${more}`,
          chart: hourChart(inR, color),
        },
        [...chips, S.listChip],
      );
    }

    case 'ranking': {
      const counts = ctx.categories
        .map((c) => ({ c, n: inR.filter((e) => e.categoryId === c.id).length }))
        .filter((x) => x.n > 0)
        .sort((a, b) => b.n - a.n);
      if (!counts.length) return nothing(S.anything);
      const [top, second, third] = counts;
      let sentence = S.leads(top.c.name, r.label, ft, top.n);
      if (second) sentence += S.followedBy(second.c.name, second.n);
      if (third) sentence += S.andThen(third.c.name, third.n);
      sentence += '.';
      return base(
        {
          headline: `${top.c.emoji} ${top.c.name}`,
          caption: times(top.n),
          sentence,
          chart: {
            kind: 'bars',
            values: counts.slice(0, 7).map((x) => x.n),
            labels: counts.slice(0, 7).map((x) => x.c.emoji),
            highlight: 0,
          },
        },
        [r.chip, S.rankingChip],
      );
    }
  }
}
