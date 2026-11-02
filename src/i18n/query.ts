import { defineStrings, pluralAr } from '../lib/i18n';

/**
 * Everything the answer engine says (src/lib/query/execute.ts + resolve.ts).
 * English templates are the original wording, byte for byte. Numbers stay as
 * Western digits in both languages so they match the rest of the app.
 */

type Per = 'day' | 'week' | 'month';

const arTimes = (n: number) =>
  pluralAr(n, { one: 'مرة واحدة', two: 'مرتين', few: '{n} مرات', many: '{n} مرة', other: '{n} مرة' });
const arDays = (n: number) =>
  pluralAr(n, { one: 'يوم واحد', two: 'يومين', few: '{n} أيام', many: '{n} يومًا', other: '{n} يوم' });
/** unit word for after a digit headline: "3 أيام", "12 يوم" */
const arUnit = (n: number, single: string, few: string) => {
  const m = Math.abs(n) % 100;
  return m >= 3 && m <= 10 ? few : single;
};
const enTimes = (n: number) => `${n} ${n === 1 ? 'time' : 'times'}`;

const en = {
  times: enTimes,
  /** caption under a big number */
  timesCaption: (n: number): string => (n === 1 ? 'time' : 'times'),
  subjectAll: 'everything',
  subjectTwo: (a: string, b: string) => `${a} and ${b}`,
  subjectMany: (n: number) => `${n} categories`,
  allCategories: 'All categories',
  cap: (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s),

  // filters
  onWeekends: 'on weekends',
  onWeekdays: 'on weekdays',
  onDays: (names: string[]) => 'on ' + names.map((d) => d + 's').join(' and '),
  morning: 'in the morning',
  afternoon: 'in the afternoon',
  evening: 'in the evening',
  night: 'at night',
  after: (h: string) => `after ${h}`,
  before: (h: string) => `before ${h}`,
  between: (a: string, b: string) => `between ${a} and ${b}`,

  // ranges (label reads after a verb, chip is short)
  inMonth: (m: string) => `in ${m}`,
  onDay: (d: string) => `on ${d}`,
  betweenDays: (a: string, b: string) => `between ${a} and ${b}`,
  today: 'today',
  todayChip: 'Today',
  yesterday: 'yesterday',
  yesterdayChip: 'Yesterday',
  thisWeek: 'this week',
  thisWeekChip: 'This week',
  lastWeek: 'last week',
  lastWeekChip: 'Last week',
  thisMonth: 'this month',
  thisMonthChip: 'This month',
  lastMonth: 'last month',
  lastMonthChip: 'Last month',
  thisYear: 'this year',
  lastYear: 'last year',
  lastNDays: (n: number) => `in the last ${n} days`,
  lastNDaysChip: (n: number) => `Last ${n} days`,
  soFar: 'so far',
  allTimeChip: 'All time',
  weekBefore: 'the week before',
  weekBeforeChip: 'Week before',
  daysBefore: (n: number) => `the ${n} days before`,
  daysBeforeChip: (n: number) => `Previous ${n} days`,

  // empty states
  noMatchCaption: 'no matching category',
  noMatch: (word: string, names: string[]) =>
    `You don't count “${word}” yet.${names.length ? ` You're tracking ${names.join(', ')}.` : ''} Add it as a bubble and I'll start keeping track.`,
  quoted: (word: string) => `“${word}”`,
  nothingYetCaption: 'nothing yet',
  notCounting:
    'You are not counting anything yet. Add a bubble on the home screen and ask me again once you have a few taps.',
  nothing: (what: string, label: string, ft: string, allTime: boolean) =>
    allTime ? `Nothing logged for ${what}${ft} yet.` : `Nothing logged for ${what} ${label}${ft}.`,
  anything: 'anything',

  // count
  countChip: 'Count',
  loggedTimes: (what: string, n: number, label: string, ft: string) =>
    `You logged ${what} ${enTimes(n)} ${label}${ft}.`,
  aboutPerDay: (x: string) => ` That's about ${x} a day.`,
  moments: (n: number, label: string, ft: string, cats: number) =>
    `${n} ${n === 1 ? 'moment' : 'moments'} ${label}${ft}${cats ? ` across ${cats} ${cats === 1 ? 'category' : 'categories'}` : ''}.`,
  mostOf: (name: string, n: number) => ` Most of it was ${name} (${n}).`,

  // peak
  kOfN: (k: number, n: number) => `${k} of ${n} times`,
  peakHour: (subject: string, a: string, b: string, k: number, n: number, label: string, ft: string) =>
    `${subject} peaks between ${a} and ${b} — ${k} of ${n} ${label}${ft}.`,
  byHour: 'By hour',
  weekdayPlural: (day: string) => `${day}s`,
  peakWeekday: (day: string, subject: string, k: number, n: number, label: string, ft: string) =>
    `${day}s are the busiest day for ${subject} — ${k} of ${n} ${label}${ft}.`,
  byWeekday: 'By weekday',
  weekOf: (day: number, month: string) => `Week of ${day} ${month}`,
  peakWeek: (subject: string, date: string, c: number) =>
    `Your busiest week for ${subject} started ${date}, with ${enTimes(c)}.`,
  byWeek: 'By week',
  peakMonth: (month: string, y: number, subject: string, c: number) =>
    `${month} ${y} was the biggest month for ${subject}, with ${enTimes(c)}.`,
  byMonth: 'By month',
  peakDay: (subject: string, day: string | null, date: string, c: number, ft: string) =>
    `Your busiest day for ${subject} was ${day === 'today' ? 'today' : date}, with ${enTimes(c)}${ft}.`,
  byDay: 'By day',
  usualCaption: 'usual time',
  usual: (subject: string, hour: string, day: string, k: number, n: number, date: string, c: number) =>
    `${subject} usually happens around ${hour}, and ${day}s are the busiest day of the week (${k} of ${n}). ` +
    `Heaviest single day: ${date} with ${enTimes(c)}.`,
  peakChip: 'Peak',

  // last / first
  entry: 'entry',
  near: (place: string) => ` near ${place}`,
  last: (
    all: boolean,
    what: string,
    recentDay: string | null,
    date: string,
    time: string,
    where: string,
    ago: string,
  ) =>
    `${all ? `Your most recent entry was ${what}. It` : `Your most recent ${what} entry`} was ${recentDay ? recentDay.toLowerCase() : `on ${date}`} at ${time}${where} — ${ago} ago.`,
  first: (all: boolean, what: string, date: string, time: string, where: string, n: number) =>
    `${all ? `Your first entry was ${what}. It` : `Your first ${what} entry`} was on ${date} at ${time}${where}. ${enTimes(n)} since.`,
  mostRecentChip: 'Most recent',
  firstChip: 'First',

  // average
  perCaption: (per: Per) => `per ${per}`,
  average: (
    all: boolean,
    subject: string,
    value: string,
    per: Per,
    label: string,
    ft: string,
    total: number,
    days: number,
  ) =>
    `On average ${all ? 'you logged' : `you logged ${subject}`} ${value} times a ${per} ${label}${ft} — ${total} over ${days} ${days === 1 ? 'day' : 'days'}.`,
  perChip: (per: Per) => `Per ${per}`,

  // compare
  byThisPoint: (label: string) => `${label} by this point`,
  same: 'Exactly the same.',
  trend: (diff: number, pct: number | null) =>
    `That's ${Math.abs(diff)} ${diff > 0 ? 'more' : 'fewer'}${pct !== null ? ` (${diff > 0 ? '+' : ''}${pct}%)` : ''}.`,
  vs: (a: number, b: number) => `${a} vs ${b}`,
  newCaption: 'new',
  compare: (subject: string, a: number, label: string, b: number, prevLabel: string, ft: string, trend: string) =>
    `${subject}: ${a} ${label} vs ${b} ${prevLabel}${ft}. ${trend}`,
  vsChip: (chip: string) => `vs ${chip}`,
  compareChip: 'Compare',

  // streak
  daysHeadline: (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`,
  streakCaption: 'longest streak',
  streak: (subject: string, longest: number, end: string | null, current: number) =>
    `Your longest run of ${subject} was ${longest} ${longest === 1 ? 'day' : 'days'} in a row${end ? `, ending ${end}` : ''}. Current streak: ${current} ${current === 1 ? 'day' : 'days'}.`,
  streakChip: 'Streak',

  // gap
  gapNow: (subject: string, dur: string, date: string, time: string) =>
    `You're in your longest break from ${subject} right now — ${dur} since ${date} at ${time}.`,
  gapPast: (subject: string, dur: string, from: string, to: string, since: string) =>
    `Your longest break from ${subject} was ${dur}, from ${from} to ${to}. It's been ${since} since the last one.`,
  andCounting: 'and counting',
  longestBreak: 'longest break',
  gapChip: 'Longest gap',

  // list
  listSep: ', ',
  moreDays: (n: number) => ` (+${n} more days)`,
  listChip: 'List',

  // ranking
  leads: (name: string, label: string, ft: string, n: number) => `${name} leads ${label}${ft} with ${enTimes(n)}`,
  followedBy: (name: string, n: number) => `, followed by ${name} (${n})`,
  andThen: (name: string, n: number) => ` and ${name} (${n})`,
  rankingChip: 'Ranking',
};

export const queryStrings = defineStrings(en, {
  times: arTimes,
  timesCaption: (n) => arUnit(n, 'مرة', 'مرات'),
  subjectAll: 'كل شيء',
  subjectTwo: (a, b) => `${a} و${b}`,
  subjectMany: (n) =>
    pluralAr(n, { one: 'فئة واحدة', two: 'فئتين', few: '{n} فئات', many: '{n} فئة', other: '{n} فئة' }),
  allCategories: 'كل الفئات',
  cap: (s) => s,

  onWeekends: 'في عطلة نهاية الأسبوع',
  onWeekdays: 'في أيام العمل',
  onDays: (names) =>
    `أيام ${names.length > 1 ? `${names.slice(0, -1).join('، ')} و${names[names.length - 1]}` : names[0]}`,
  morning: 'في الصباح',
  afternoon: 'بعد الظهر',
  evening: 'في المساء',
  night: 'في الليل',
  after: (h) => `بعد ${h}`,
  before: (h) => `قبل ${h}`,
  between: (a, b) => `بين ${a} و${b}`,

  inMonth: (m) => `في ${m}`,
  onDay: (d) => `يوم ${d}`,
  betweenDays: (a, b) => `بين ${a} و${b}`,
  today: 'اليوم',
  todayChip: 'اليوم',
  yesterday: 'أمس',
  yesterdayChip: 'أمس',
  thisWeek: 'هذا الأسبوع',
  thisWeekChip: 'هذا الأسبوع',
  lastWeek: 'الأسبوع الماضي',
  lastWeekChip: 'الأسبوع الماضي',
  thisMonth: 'هذا الشهر',
  thisMonthChip: 'هذا الشهر',
  lastMonth: 'الشهر الماضي',
  lastMonthChip: 'الشهر الماضي',
  thisYear: 'هذا العام',
  lastYear: 'العام الماضي',
  lastNDays: (n) => `خلال آخر ${arDays(n)}`,
  lastNDaysChip: (n) => `آخر ${arDays(n)}`,
  soFar: 'حتى الآن',
  allTimeChip: 'كل الوقت',
  weekBefore: 'في الأسبوع الذي قبله',
  weekBeforeChip: 'الأسبوع السابق',
  daysBefore: (n) => `في ${arDays(n)} السابقة`,
  daysBeforeChip: (n) => `${arDays(n)} السابقة`,

  noMatchCaption: 'لا توجد فئة مطابقة',
  noMatch: (word, names) =>
    `أنت لا تعدّ «${word}» بعد.${names.length ? ` أنت تتابع ${names.join('، ')}.` : ''} أضفه كفقاعة وسأبدأ بالعدّ.`,
  quoted: (word) => `«${word}»`,
  nothingYetCaption: 'لا شيء بعد',
  notCounting: 'أنت لا تعدّ أي شيء بعد. أضف فقاعة في الشاشة الرئيسية واسألني مرة أخرى بعد بضع نقرات.',
  nothing: (what, label, ft, allTime) => (allTime ? `لم تسجّل ${what}${ft} بعد.` : `لم تسجّل ${what} ${label}${ft}.`),
  anything: 'أي شيء',

  countChip: 'العدد',
  loggedTimes: (what, n, label, ft) => `سجّلت ${what} ${arTimes(n)} ${label}${ft}.`,
  aboutPerDay: (x) => ` أي حوالي ${x} في اليوم.`,
  moments: (n, label, ft, cats) =>
    `${pluralAr(n, { one: 'لحظة واحدة', two: 'لحظتان', few: '{n} لحظات', many: '{n} لحظة', other: '{n} لحظة' })} ${label}${ft}${
      cats
        ? ` في ${pluralAr(cats, { one: 'فئة واحدة', two: 'فئتين', few: '{n} فئات', many: '{n} فئة', other: '{n} فئة' })}`
        : ''
    }.`,
  mostOf: (name, n) => ` معظمها ${name} (${n}).`,

  kOfN: (k, n) => `${k} من ${n}`,
  peakHour: (subject, a, b, k, n, label, ft) => `ذروة ${subject} بين ${a} و${b} — ${k} من ${n} ${label}${ft}.`,
  byHour: 'حسب الساعة',
  weekdayPlural: (day) => `أيام ${day}`,
  peakWeekday: (day, subject, k, n, label, ft) =>
    `يوم ${day} هو أكثر يوم تسجّل فيه ${subject} — ${k} من ${n} ${label}${ft}.`,
  byWeekday: 'حسب يوم الأسبوع',
  weekOf: (day, month) => `أسبوع ${day} ${month}`,
  peakWeek: (subject, date, c) => `أكثر أسبوع سجّلت فيه ${subject} بدأ ${date}، بواقع ${arTimes(c)}.`,
  byWeek: 'حسب الأسبوع',
  peakMonth: (month, y, subject, c) => `أكثر شهر سجّلت فيه ${subject} كان ${month} ${y}، بواقع ${arTimes(c)}.`,
  byMonth: 'حسب الشهر',
  peakDay: (subject, day, date, c, ft) =>
    `أكثر يوم سجّلت فيه ${subject} كان ${day === 'today' ? 'اليوم' : date}، بواقع ${arTimes(c)}${ft}.`,
  byDay: 'حسب اليوم',
  usualCaption: 'الوقت المعتاد',
  usual: (subject, hour, day, k, n, date, c) =>
    `عادةً ما يكون ${subject} حوالي ${hour}، ويوم ${day} هو الأكثر في الأسبوع (${k} من ${n}). ` +
    `أكثر يوم: ${date} بواقع ${arTimes(c)}.`,
  peakChip: 'الذروة',

  entry: 'إدخال',
  near: (place) => ` قرب ${place}`,
  last: (all, what, recentDay, date, time, where, ago) =>
    `${all ? `آخر إدخال كان ${what}، وكان` : `آخر مرة سجّلت فيها ${what} كانت`} ${recentDay ?? `يوم ${date}`} الساعة ${time}${where} — منذ ${ago}.`,
  first: (all, what, date, time, where, n) =>
    `${all ? `أول إدخال كان ${what}، وكان` : `أول مرة سجّلت فيها ${what} كانت`} يوم ${date} الساعة ${time}${where}. ${arTimes(n)} منذ ذلك الحين.`,
  mostRecentChip: 'الأحدث',
  firstChip: 'الأولى',

  perCaption: (per) => (per === 'day' ? 'في اليوم' : per === 'week' ? 'في الأسبوع' : 'في الشهر'),
  average: (all, subject, value, per, label, ft, total, days) =>
    `في المتوسط سجّلت ${all ? '' : `${subject} `}${value} مرة ${per === 'day' ? 'في اليوم' : per === 'week' ? 'في الأسبوع' : 'في الشهر'} ${label}${ft} — ${total} خلال ${arDays(days)}.`,
  perChip: (per) => (per === 'day' ? 'لكل يوم' : per === 'week' ? 'لكل أسبوع' : 'لكل شهر'),

  byThisPoint: (label) => `${label} حتى الوقت نفسه`,
  same: 'العدد نفسه تمامًا.',
  trend: (diff, pct) =>
    `أي ${Math.abs(diff)} ${diff > 0 ? 'أكثر' : 'أقل'}${pct !== null ? ` (${diff > 0 ? '+' : ''}${pct}%)` : ''}.`,
  vs: (a, b) => `${a} مقابل ${b}`,
  newCaption: 'جديد',
  compare: (subject, a, label, b, prevLabel, ft, trend) =>
    `${subject}: ${a} ${label} مقابل ${b} ${prevLabel}${ft}. ${trend}`,
  vsChip: (chip) => `مقابل ${chip}`,
  compareChip: 'مقارنة',

  daysHeadline: (n) => `${n} ${arUnit(n, 'يوم', 'أيام')}`,
  streakCaption: 'أطول سلسلة',
  streak: (subject, longest, end, current) =>
    `أطول سلسلة متتالية من ${subject} كانت ${arDays(longest)}${end ? `، وانتهت ${end}` : ''}. السلسلة الحالية: ${arDays(current)}.`,
  streakChip: 'سلسلة',

  gapNow: (subject, dur, date, time) => `أنت الآن في أطول انقطاع عن ${subject} — ${dur} منذ ${date} الساعة ${time}.`,
  gapPast: (subject, dur, from, to, since) =>
    `أطول انقطاع عن ${subject} كان ${dur}، من ${from} إلى ${to}. مرّ ${since} منذ آخر مرة.`,
  andCounting: 'وما زال مستمرًا',
  longestBreak: 'أطول انقطاع',
  gapChip: 'أطول انقطاع',

  listSep: '، ',
  moreDays: (n) => ` (+${arDays(n)} أخرى)`,
  listChip: 'قائمة',

  leads: (name, label, ft, n) => `يتصدّر ${name} ${label}${ft} بواقع ${arTimes(n)}`,
  followedBy: (name, n) => `، يليه ${name} (${n})`,
  andThen: (name, n) => ` ثم ${name} (${n})`,
  rankingChip: 'الترتيب',
});
