/**
 * Small, dependency-free date helpers. Everything works in the device's local
 * time zone (calendar days, hours) because that's how people think about
 * "today" and "at night". Arithmetic goes through setDate/setMonth so DST
 * changes don't shift day boundaries.
 *
 * Display helpers follow the app language (`getLang()`). The English name
 * arrays stay exported because the on-device question parser reads English.
 */

import { getLang, pluralAr } from './i18n';

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** Weeks start on Monday. */
export const WEEK_STARTS_ON = 1;

export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const WEEKDAY_INITIALS_AR = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];
const MONTHS_AR = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

const ar = () => getLang() === 'ar';
/** "Mon" / "الاثنين" (0 = Sunday) */
export const weekdayShort = (i: number) => (ar() ? WEEKDAYS_AR[i] : WEEKDAYS_SHORT[i]);
/** "Monday" / "الاثنين" */
export const weekdayLong = (i: number) => (ar() ? WEEKDAYS_AR[i] : WEEKDAYS_LONG[i]);
/** One-letter chart label: "M" / "ن" */
export const weekdayInitial = (i: number) => (ar() ? WEEKDAY_INITIALS_AR[i] : WEEKDAYS_SHORT[i].charAt(0));
/** "Oct" / "أكتوبر" (0 = January) */
export const monthShort = (i: number) => (ar() ? MONTHS_AR[i] : MONTHS_SHORT[i]);
/** "October" / "أكتوبر" */
export const monthLong = (i: number) => (ar() ? MONTHS_AR[i] : MONTHS_LONG[i]);
const am = (isAm: boolean) => (ar() ? (isAm ? 'ص' : 'م') : isAm ? 'AM' : 'PM');

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const diff = (x.getDay() - WEEK_STARTS_ON + 7) % 7;
  return addDays(x, -diff);
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar day key, `YYYY-MM-DD`. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parses `YYYY-MM-DD` as local midnight. Returns null if invalid. */
export function parseDayKey(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Whole calendar days from a to b (b - a). */
export function calendarDaysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY);
}

export function isSameDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b);
}

let use24hCache: boolean | null = null;
/** Respects the device's 12/24h preference when Intl can tell us. */
export function uses24h(): boolean {
  if (use24hCache !== null) return use24hCache;
  try {
    const parts = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions() as any;
    use24hCache = parts.hourCycle ? parts.hourCycle === 'h23' || parts.hourCycle === 'h24' : !parts.hour12;
  } catch {
    use24hCache = false;
  }
  return use24hCache;
}

export function formatTime(d: Date): string {
  const h = d.getHours();
  const m = pad(d.getMinutes());
  if (uses24h()) return `${pad(h)}:${m}`;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${am(h < 12)}`;
}

/** "9 PM" / "21:00" */
export function formatHour(h: number): string {
  const hh = ((h % 24) + 24) % 24;
  if (uses24h()) return `${pad(hh)}:00`;
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12} ${am(hh < 12)}`;
}

/** "12a", "6a", "12p", "6p" style compact hour label for charts */
export function formatHourCompact(h: number): string {
  if (uses24h()) return pad(h);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return ar() ? `${h12}${am(h < 12)}` : `${h12}${h < 12 ? 'a' : 'p'}`;
}

/** "Mon 24 Oct" (+ year when not this year) */
export function formatDate(d: Date, now: Date = new Date()): string {
  const base = `${weekdayShort(d.getDay())} ${d.getDate()} ${monthShort(d.getMonth())}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

/** "Today", "Yesterday", or a date */
export function formatDayLabel(d: Date, now: Date = new Date()): string {
  const diff = calendarDaysBetween(d, now);
  if (diff === 0) return ar() ? 'اليوم' : 'Today';
  if (diff === 1) return ar() ? 'أمس' : 'Yesterday';
  if (diff > 1 && diff < 7) return weekdayLong(d.getDay());
  return formatDate(d, now);
}

/** "2h 14m", "3d 4h", "45m", "20s" */
export function formatDuration(ms: number): string {
  const abs = Math.max(0, ms);
  const d = Math.floor(abs / DAY);
  const h = Math.floor((abs % DAY) / HOUR);
  const m = Math.floor((abs % HOUR) / MINUTE);
  if (ar()) {
    if (d > 0) return h > 0 ? `${d}ي ${h}س` : `${d}ي`;
    if (h > 0) return m > 0 ? `${h}س ${m}د` : `${h}س`;
    if (m > 0) return `${m}د`;
    return `${Math.floor(abs / 1000)}ث`;
  }
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return `${m}m`;
  return `${Math.floor(abs / 1000)}s`;
}

/** Natural "2 hours ago" / "yesterday at 21:04" */
export function formatRelative(d: Date, now: Date = new Date()): string {
  const ms = now.getTime() - d.getTime();
  if (ar()) return formatRelativeAr(d, now, ms);
  if (ms < 45_000) return 'just now';
  if (ms < HOUR) {
    const m = Math.round(ms / MINUTE);
    return `${m} min ago`;
  }
  if (ms < 12 * HOUR) {
    const h = Math.floor(ms / HOUR);
    return `${h} hour${h === 1 ? '' : 's'} ago`;
  }
  const days = calendarDaysBetween(d, now);
  if (days === 0) return `today at ${formatTime(d)}`;
  if (days === 1) return `yesterday at ${formatTime(d)}`;
  if (days < 7) return `${days} days ago`;
  if (days < 60) {
    const w = Math.round(days / 7);
    return `${w} week${w === 1 ? '' : 's'} ago`;
  }
  const mo = Math.round(days / 30);
  if (mo < 12) return `${mo} months ago`;
  const y = Math.round(days / 365);
  return `${y} year${y === 1 ? '' : 's'} ago`;
}

const AR_UNITS = {
  minute: { one: 'دقيقة', two: 'دقيقتين', few: '{n} دقائق', many: '{n} دقيقة', other: '{n} دقيقة' },
  hour: { one: 'ساعة', two: 'ساعتين', few: '{n} ساعات', many: '{n} ساعة', other: '{n} ساعة' },
  day: { one: 'يوم', two: 'يومين', few: '{n} أيام', many: '{n} يومًا', other: '{n} يوم' },
  week: { one: 'أسبوع', two: 'أسبوعين', few: '{n} أسابيع', many: '{n} أسبوعًا', other: '{n} أسبوع' },
  month: { one: 'شهر', two: 'شهرين', few: '{n} أشهر', many: '{n} شهرًا', other: '{n} شهر' },
  year: { one: 'سنة', two: 'سنتين', few: '{n} سنوات', many: '{n} سنة', other: '{n} سنة' },
};
/** "منذ ساعتين", "{n} أيام" … — Arabic count + unit with the right plural form. */
export function arCount(n: number, unit: keyof typeof AR_UNITS): string {
  return pluralAr(n, AR_UNITS[unit]);
}

function formatRelativeAr(d: Date, now: Date, ms: number): string {
  if (ms < 45_000) return 'الآن';
  if (ms < HOUR) return `منذ ${arCount(Math.round(ms / MINUTE), 'minute')}`;
  if (ms < 12 * HOUR) return `منذ ${arCount(Math.floor(ms / HOUR), 'hour')}`;
  const days = calendarDaysBetween(d, now);
  if (days === 0) return `اليوم الساعة ${formatTime(d)}`;
  if (days === 1) return `أمس الساعة ${formatTime(d)}`;
  if (days < 7) return `منذ ${arCount(days, 'day')}`;
  if (days < 60) return `منذ ${arCount(Math.round(days / 7), 'week')}`;
  const mo = Math.round(days / 30);
  if (mo < 12) return `منذ ${arCount(mo, 'month')}`;
  return `منذ ${arCount(Math.round(days / 365), 'year')}`;
}

export function deviceTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

const SMALL_NUMBERS = [
  'Zero',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
];
/** Editorial numbers: "Seven" for small counts, digits otherwise (always digits in Arabic). */
export function numberWord(n: number): string {
  if (ar()) return String(n);
  return n >= 0 && n < SMALL_NUMBERS.length ? SMALL_NUMBERS[n] : String(n);
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
