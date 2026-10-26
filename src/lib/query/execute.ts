/**
 * Deterministic executor: QuerySpec + events → Answer.
 * This is the only place numbers in answers come from.
 */
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
  MONTHS_LONG,
  MONTHS_SHORT,
  WEEKDAYS_LONG,
  WEEKDAYS_SHORT,
  addDays,
  dayKey,
  formatDate,
  formatDayLabel,
  formatDuration,
  formatHour,
  formatHourCompact,
  formatRelative,
  formatTime,
  parseDayKey,
  startOfDay,
  startOfWeek,
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
const times = (n: number) => `${n} ${n === 1 ? 'time' : 'times'}`;

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
  const parts: string[] = [];
  if (f.weekdays?.length) {
    const w = [...f.weekdays].sort();
    if (w.join() === '0,6') parts.push('on weekends');
    else if (w.join() === '1,2,3,4,5') parts.push('on weekdays');
    else parts.push('on ' + w.map((d) => WEEKDAYS_LONG[d] + 's').join(' and '));
  }
  if (f.hourFrom !== undefined || f.hourTo !== undefined) {
    const a = f.hourFrom ?? 0;
    const b = f.hourTo ?? 24;
    const key = `${a}-${b}`;
    const named: Record<string, string> = {
      '5-12': 'in the morning',
      '12-17': 'in the afternoon',
      '17-22': 'in the evening',
      '22-5': 'at night',
    };
    if (named[key]) parts.push(named[key]);
    else if (b === 24) parts.push(`after ${formatHour(a)}`);
    else if (a === 0) parts.push(`before ${formatHour(b)}`);
    else parts.push(`between ${formatHour(a)} and ${formatHour(b)}`);
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
    labels.push(MONTHS_SHORT[m.getMonth()].slice(0, 1));
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
    labels.push(days <= 7 ? WEEKDAYS_SHORT[d.getDay()].slice(0, 1) : i % 5 === 0 ? String(d.getDate()) : '');
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
    labels: order.map((i) => WEEKDAYS_SHORT[i].slice(0, 1)),
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

  const subject = single
    ? single.name
    : all
      ? 'everything'
      : selected.length === 2
        ? `${selected[0].name} and ${selected[1].name}`
        : `${selected.length} categories`;
  const subjectChip = single
    ? `${single.emoji} ${single.name}`
    : all
      ? 'All categories'
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
      caption: 'no matching category',
      sentence: `You don't count “${spec.unmatched}” yet.${
        names.length ? ` You're tracking ${names.join(', ')}.` : ''
      } Add it as a bubble and I'll start keeping track.`,
      interpretation: [`“${spec.unmatched}”`],
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
      caption: 'nothing yet',
      sentence:
        'You are not counting anything yet. Add a bubble on the home screen and ask me again once you have a few taps.',
    });
  }

  const nothing = (what: string) =>
    base(
      {
        headline: '0',
        caption: 'times',
        sentence: r.allTime ? `Nothing logged for ${what}${ft} yet.` : `Nothing logged for ${what} ${r.label}${ft}.`,
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
        sentence = `You logged ${single.name} ${times(n)} ${r.label}${ft}.`;
        if (n > 0 && days > 1) sentence += ` That's about ${fmt(n / days)} a day.`;
        if (days > 1) chart = days <= 31 ? dailyChart(inR, r, now, color) : monthlyChart(inR, r, now, color);
      } else {
        const counts = cats
          .map((c) => ({ c, n: inR.filter((e) => e.categoryId === c.id).length }))
          .filter((x) => x.n > 0)
          .sort((a, b) => b.n - a.n);
        sentence = all
          ? `${n} ${n === 1 ? 'moment' : 'moments'} ${r.label}${ft}${counts.length ? ` across ${counts.length} ${counts.length === 1 ? 'category' : 'categories'}` : ''}.`
          : `You logged ${subject} ${times(n)} ${r.label}${ft}.`;
        if (counts.length) {
          sentence += ` Most of it was ${counts[0].c.name} (${counts[0].n}).`;
          chart = {
            kind: 'bars',
            values: counts.slice(0, 7).map((x) => x.n),
            labels: counts.slice(0, 7).map((x) => x.c.emoji),
            highlight: 0,
          };
        }
      }
      return base({ headline: String(n), caption: n === 1 ? 'time' : 'times', sentence, chart }, [...chips, 'Count']);
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
              caption: `${h[i]} of ${n} times`,
              sentence: `${cap(subject)} peaks between ${formatHour(i)} and ${formatHour(i + 1)} — ${h[i]} of ${n} ${r.label}${ft}.`,
              chart: hourChart(inR, color),
            },
            [...chips, 'By hour'],
          );
        }
        case 'weekday': {
          const h = weekdayHistogram(inR);
          const i = argmax(h);
          return base(
            {
              headline: `${WEEKDAYS_LONG[i]}s`,
              caption: `${h[i]} of ${n} times`,
              sentence: `${WEEKDAYS_LONG[i]}s are the busiest day for ${subject} — ${h[i]} of ${n} ${r.label}${ft}.`,
              chart: weekdayChart(inR, color),
            },
            [...chips, 'By weekday'],
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
              headline: `Week of ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`,
              caption: times(c),
              sentence: `Your busiest week for ${subject} started ${formatDate(d, now)}, with ${times(c)}.`,
            },
            [...chips, 'By week'],
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
              headline: `${MONTHS_LONG[mo]}${y === now.getFullYear() ? '' : ` ${y}`}`,
              caption: times(c),
              sentence: `${MONTHS_LONG[mo]} ${y} was the biggest month for ${subject}, with ${times(c)}.`,
              chart: monthlyChart(inR, r, now, color),
            },
            [...chips, 'By month'],
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
                sentence: `Your busiest day for ${subject} was ${formatDayLabel(d, now).toLowerCase() === 'today' ? 'today' : formatDate(d, now)}, with ${times(c)}${ft}.`,
                chart: dailyChart(inR, r, now, color),
              },
              [...chips, 'By day'],
            );
          }
          // no grouping asked: give the full picture — usual hour, busiest weekday, heaviest day
          const hour = typicalHour(inR)!;
          const wd = weekdayHistogram(inR);
          const wi = argmax(wd);
          return base(
            {
              headline: `~${formatHour(hour)}`,
              caption: 'usual time',
              sentence:
                `${cap(subject)} usually happens around ${formatHour(hour)}, and ${WEEKDAYS_LONG[wi]}s are the busiest day of the week (${wd[wi]} of ${n}). ` +
                `Heaviest single day: ${formatDate(d, now)} with ${times(c)}.`,
              chart: hourChart(inR, color),
            },
            [...chips, 'Peak'],
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
      const what = single ? single.name : `${cat?.emoji ?? ''} ${cat?.name ?? 'entry'}`.trim();
      const day = formatDayLabel(d, now);
      const where = e.place ? ` near ${e.place}` : '';
      const sentence =
        spec.intent === 'last'
          ? `${all ? `Your most recent entry was ${what}. It` : `Your most recent ${what} entry`} was ${day === 'Today' || day === 'Yesterday' ? day.toLowerCase() : `on ${formatDate(d, now)}`} at ${formatTime(d)}${where} — ${formatDuration(now.getTime() - d.getTime())} ago.`
          : `${all ? `Your first entry was ${what}. It` : `Your first ${what} entry`} was on ${formatDate(d, now)} at ${formatTime(d)}${where}. ${times(inR.length)} since.`;
      return base(
        {
          headline: spec.intent === 'last' ? formatRelative(d, now) : formatDate(d, now),
          caption: `${formatDate(d, now)} · ${formatTime(d)}`,
          sentence,
        },
        [...chips, spec.intent === 'last' ? 'Most recent' : 'First'],
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
          caption: `per ${per}`,
          sentence: `On average ${subject === 'everything' ? 'you logged' : `you logged ${subject}`} ${fmt(value)} times a ${per} ${r.label}${ft} — ${inR.length} over ${days} ${days === 1 ? 'day' : 'days'}.`,
          chart: days > 1 && days <= 31 ? dailyChart(inR, r, now, color) : undefined,
        },
        [...chips, `Per ${per}`],
      );
    }

    case 'compare': {
      let prev = spec.compareTo ? resolveRange(spec.compareTo, now, first) : previousRange(spec.range, r, now);
      let prevLabel = prev.label;
      // mid-period: compare like with like (Monday 9am vs last Monday 9am, not a whole week)
      if (now >= r.from && now < r.to && prev.to <= r.from) {
        prev = clipToElapsed(prev, r, now);
        prevLabel = `${prev.label} by this point`;
      }
      const a = inR.length;
      const b = inRange(scoped, prev.from, prev.to).length;
      const pct = pctChange(a, b);
      const diff = a - b;
      const trend =
        diff === 0
          ? 'Exactly the same.'
          : `That's ${Math.abs(diff)} ${diff > 0 ? 'more' : 'fewer'}${pct !== null ? ` (${diff > 0 ? '+' : ''}${pct}%)` : ''}.`;
      return base(
        {
          headline: `${a} vs ${b}`,
          caption: pct === null ? 'new' : `${pct > 0 ? '+' : ''}${pct}%`,
          sentence: `${cap(subject)}: ${a} ${r.label} vs ${b} ${prevLabel}${ft}. ${trend}`,
          chart: { kind: 'bars', values: [b, a], labels: [prev.chip, r.chip], highlight: 1, color },
        },
        [r.chip, `vs ${prev.chip}`, 'Compare'],
      );
    }

    case 'streak': {
      if (!inR.length) return nothing(subject);
      const s = streaks(inR, now);
      return base(
        {
          headline: `${s.longest} ${s.longest === 1 ? 'day' : 'days'}`,
          caption: 'longest streak',
          sentence: `Your longest run of ${subject} was ${s.longest} ${s.longest === 1 ? 'day' : 'days'} in a row${s.longestEnd ? `, ending ${formatDate(s.longestEnd, now)}` : ''}. Current streak: ${s.current} ${s.current === 1 ? 'day' : 'days'}.`,
        },
        [...chips, 'Streak'],
      );
    }

    case 'gap': {
      if (!inR.length) return nothing(subject);
      const g = gaps(inR, now);
      const ongoing = g.longestTo === null;
      const sentence = ongoing
        ? `You're in your longest break from ${subject} right now — ${formatDuration(g.longestMs)} since ${formatDate(g.longestFrom!, now)} at ${formatTime(g.longestFrom!)}.`
        : `Your longest break from ${subject} was ${formatDuration(g.longestMs)}, from ${formatDate(g.longestFrom!, now)} to ${formatDate(g.longestTo!, now)}. It's been ${formatDuration(g.currentMs)} since the last one.`;
      return base(
        { headline: formatDuration(g.longestMs), caption: ongoing ? 'and counting' : 'longest break', sentence },
        [...chips, 'Longest gap'],
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
        .map(([k, ds]) => `${k}: ${ds.slice(0, 8).map(formatTime).join(', ')}${ds.length > 8 ? '…' : ''}`)
        .join(' · ');
      const more = groups.size > shown.length ? ` (+${groups.size - shown.length} more days)` : '';
      return base(
        {
          headline: String(n),
          caption: n === 1 ? 'time' : 'times',
          sentence: `${body}${more}`,
          chart: hourChart(inR, color),
        },
        [...chips, 'List'],
      );
    }

    case 'ranking': {
      const counts = ctx.categories
        .map((c) => ({ c, n: inR.filter((e) => e.categoryId === c.id).length }))
        .filter((x) => x.n > 0)
        .sort((a, b) => b.n - a.n);
      if (!counts.length) return nothing('anything');
      const [top, second, third] = counts;
      let sentence = `${top.c.name} leads ${r.label}${ft} with ${times(top.n)}`;
      if (second) sentence += `, followed by ${second.c.name} (${second.n})`;
      if (third) sentence += ` and ${third.c.name} (${third.n})`;
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
        [r.chip, 'Ranking'],
      );
    }
  }
}

function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
