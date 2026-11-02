import { defineStrings } from '../lib/i18n';
import { arCount } from '../lib/time';

type Range = 'today' | 'week' | 'month' | 'year';

/** Strings for the home filter maths (lib/home-filter.ts): ranges, stat tiles, one-liners. */
export const homeFilterStrings = defineStrings(
  {
    range: { today: 'Today', week: 'Week', month: 'Month', year: 'Year' } as Record<Range, string>,
    rangeWord: (r: Range) => (r === 'today' ? 'today' : `this ${r}`),
    prevWord: (r: Range) => (r === 'today' ? 'vs yesterday' : `vs last ${r}`),
    same: 'Same',
    perDayUsually: 'a day, usually',
    perDayIn: (rangeWord: string) => `a day ${rangeWord}`,
    perWeekUsually: 'a week, usually',
    usually: 'usually',
    sinceTheLastOne: 'since the last one',
    sinceLast: 'since last',
    streakValue: (n: number) => `${n} days`,
    streak: 'streak',
    bestDay: (less: boolean, weekday: string, date: number) => `${less ? 'peak' : 'best'} day (${weekday} ${date})`,
    since: { m: 'm', h: 'h', d: 'd', w: 'w', mo: 'mo' },
    neckAndNeck: (a: string, b: string) => `Neck and neck — ${a} · ${b}`,
    forEvery: (rate: string, b: string, a: string) => `${rate} ${b} for every ${a}`,
    busiestAround: (hour: string) => `Busiest around ${hour}`,
    perDay: (rate: string) => `${rate} a day`,
    busiestOn: (weekday: string) => `busiest on ${weekday}s`,
    neverYet: (who: string) => `${who} hasn't had its first one yet`,
    lastAgo: (who: string, dur: string) => `${who} — last one ${dur} ago`,
  },
  {
    range: { today: 'اليوم', week: 'الأسبوع', month: 'الشهر', year: 'السنة' },
    rangeWord: (r) => ({ today: 'اليوم', week: 'هذا الأسبوع', month: 'هذا الشهر', year: 'هذه السنة' })[r],
    prevWord: (r) =>
      ({
        today: 'مقارنة بأمس',
        week: 'مقارنة بالأسبوع الماضي',
        month: 'مقارنة بالشهر الماضي',
        year: 'مقارنة بالسنة الماضية',
      })[r],
    same: 'مماثل',
    perDayUsually: 'يوميًا عادةً',
    perDayIn: (rangeWord) => `يوميًا ${rangeWord}`,
    perWeekUsually: 'أسبوعيًا عادةً',
    usually: 'عادةً',
    sinceTheLastOne: 'منذ آخر مرة',
    sinceLast: 'منذ آخر مرة',
    streakValue: (n) => arCount(n, 'day'),
    streak: 'متتالية',
    bestDay: (less, weekday, date) => `${less ? 'أعلى' : 'أفضل'} يوم (${weekday} ${date})`,
    since: { m: 'د', h: 'س', d: 'ي', w: 'أ', mo: 'ش' },
    neckAndNeck: (a, b) => `متقاربان — ${a} · ${b}`,
    forEvery: (rate, b, a) => `${rate} ${b} مقابل كل ${a}`,
    busiestAround: (hour) => `الذروة حوالي ${hour}`,
    perDay: (rate) => `${rate} يوميًا`,
    busiestOn: (weekday) => `الذروة أيام ${weekday}`,
    neverYet: (who) => `${who} لم يُسجَّل بعد`,
    lastAgo: (who, dur) => `${who} — آخر مرة قبل ${dur}`,
  },
);
