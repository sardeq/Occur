import { create } from 'zustand';

/**
 * Tiny, dependency-free translation layer. Strings live next to the screens
 * that use them, grouped per area with `defineStrings(en, ar)`; the Arabic
 * table must have exactly the same shape as the English one (checked by TS).
 * Values can be plain strings or functions for counts/interpolation.
 *
 * This module is pure (no native imports) so lib code and tests can use it.
 * Which language is active is decided in `lib/language.ts`.
 */

export type Lang = 'en' | 'ar';

export const useLangStore = create<{ lang: Lang }>(() => ({ lang: 'en' }));

/** Current language, reactive. */
export const useLang = () => useLangStore((s) => s.lang);
/** Current language, for non-React code. */
export const getLang = (): Lang => useLangStore.getState().lang;
export const isRTL = (lang: Lang = getLang()) => lang === 'ar';

export type Strings<T> = { en: T; ar: T };

export function defineStrings<T>(en: T, ar: NoInfer<T>): Strings<T> {
  return { en, ar };
}

/** The table for the current language; re-renders on language change. */
export function useStrings<T>(table: Strings<T>): T {
  return table[useLang()];
}

/** The table for the current language, outside React. */
export function strings<T>(table: Strings<T>, lang: Lang = getLang()): T {
  return table[lang];
}

type ArabicForms = {
  /** 0 */
  zero?: string;
  /** 1 */
  one: string;
  /** 2 */
  two: string;
  /** 3–10 */
  few: string;
  /** 11–99 */
  many: string;
  /** 100, 1000… and everything else */
  other: string;
};

/**
 * Arabic plural category for n, following CLDR. Forms are full phrases and
 * may contain `{n}`, e.g. `{ one: 'مرة واحدة', two: 'مرتان', few: '{n} مرات', many: '{n} مرة', other: '{n} مرة' }`.
 */
export function pluralAr(n: number, f: ArabicForms): string {
  const abs = Math.abs(n);
  const mod100 = abs % 100;
  let s: string;
  if (abs === 0) s = f.zero ?? f.other;
  else if (abs === 1) s = f.one;
  else if (abs === 2) s = f.two;
  else if (mod100 >= 3 && mod100 <= 10) s = f.few;
  else if (mod100 >= 11 && mod100 <= 99) s = f.many;
  else s = f.other;
  return s.replace('{n}', String(n));
}

/** English singular/plural, e.g. `pluralEn(3, 'time')` → "3 times". */
export function pluralEn(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Join a list naturally: "a, b and c" / "أ، ب وج". */
export function joinList(items: string[], lang: Lang = getLang()): string {
  if (items.length <= 1) return items.join('');
  if (lang === 'ar') return `${items.slice(0, -1).join('، ')} و${items[items.length - 1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
