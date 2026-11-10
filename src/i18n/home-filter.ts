import { defineStrings } from '../lib/i18n';

type Range = 'today' | 'week' | 'month' | 'year';

/** Strings for the home period switch (lib/home-filter.ts). */
export const homeFilterStrings = defineStrings(
  {
    range: { today: 'Day', week: 'Week', month: 'Month', year: 'Year' } as Record<Range, string>,
    title: { today: 'Today', week: 'This week', month: 'This month', year: 'This year' } as Record<Range, string>,
    rangeWord: (r: Range) => (r === 'today' ? 'today' : `this ${r}`),
  },
  {
    range: { today: 'يوم', week: 'أسبوع', month: 'شهر', year: 'سنة' },
    title: { today: 'اليوم', week: 'هذا الأسبوع', month: 'هذا الشهر', year: 'هذه السنة' },
    rangeWord: (r) => ({ today: 'اليوم', week: 'هذا الأسبوع', month: 'هذا الشهر', year: 'هذه السنة' })[r],
  },
);
