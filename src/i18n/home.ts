import { defineStrings, pluralAr, pluralEn } from '@/lib/i18n';

/** Home screen (app/index.tsx) and the pieces only it uses. */
export const homeStrings = defineStrings(
  {
    syncOffline: 'Offline, changes saved on device',
    syncing: 'Syncing',
    insights: 'Insights',
    settings: 'Settings',
    settingsA11y: 'Settings and account',

    hideTipsA11y: 'Hide tips. You can turn them back on in Settings',
    tipAddList: 'Tap + to add one',
    tipAddBubbles: 'Tap a bubble to add one',
    tipRemoveList: 'Tap − to take one away',
    tipRemoveBubbles: 'Mistake? Tap − or swipe down',
    tipOpenList: 'Tap a name for details',
    tipOpenBubbles: 'Hold a bubble for details',

    addSomething: 'Add something to count',
    add: 'Add',

    countIn: (name: string, count: number, word: string) => `${name}, ${count} ${word}`,

    moreIdeas: 'More ideas — tap to add',
    addName: (name: string) => `Add ${name}`,

    openName: (name: string) => `Open ${name}`,

    askA11y: 'Ask a question about your history',
    askPlaceholder: 'Ask a question…',

    rowA11y: (name: string, count: number, word: string) => `${name}, ${count} ${word}. Open details`,
    lastAt: (time: string) => `Last at ${time}`,
    noneToday: 'None yet today',
    takeOneAway: (name: string) => `Take one ${name} away`,
    addOne: (name: string) => `Add one ${name}`,
    countA11y: (count: number, word: string) => `${count} ${word}`,
    totalA11y: (n: number, word: string) => `${pluralEn(n, 'entry', 'entries')} ${word}`,
  },
  {
    syncOffline: 'غير متصل، التغييرات محفوظة على الجهاز',
    syncing: 'جارٍ المزامنة',
    insights: 'الإحصاءات',
    settings: 'الإعدادات',
    settingsA11y: 'الإعدادات والحساب',

    hideTipsA11y: 'إخفاء النصائح. يمكنك إعادتها من الإعدادات',
    tipAddList: 'اضغط + لإضافة واحدة',
    tipAddBubbles: 'اضغط على فقاعة لإضافة واحدة',
    tipRemoveList: 'اضغط − لحذف واحدة',
    tipRemoveBubbles: 'أخطأت؟ اضغط − أو اسحب للأسفل',
    tipOpenList: 'اضغط على الاسم لعرض التفاصيل',
    tipOpenBubbles: 'اضغط مطولًا على فقاعة لعرض التفاصيل',

    addSomething: 'أضف شيئًا لعدّه',
    add: 'إضافة',

    countIn: (name, count, word) => `${name}، ${count} ${word}`,

    moreIdeas: 'أفكار أخرى — اضغط للإضافة',
    addName: (name) => `إضافة ${name}`,

    openName: (name) => `فتح ${name}`,

    askA11y: 'اسأل عن سجلّك',
    askPlaceholder: 'اطرح سؤالًا…',

    rowA11y: (name, count, word) => `${name}، ${count} ${word}. فتح التفاصيل`,
    lastAt: (time) => `آخر مرة ${time}`,
    noneToday: 'لا شيء اليوم بعد',
    takeOneAway: (name) => `حذف واحدة من ${name}`,
    addOne: (name) => `إضافة واحدة إلى ${name}`,
    countA11y: (count, word) => `${count} ${word}`,
    totalA11y: (n, word) =>
      `${pluralAr(n, { zero: 'لا تسجيلات', one: 'تسجيل واحد', two: 'تسجيلان', few: '{n} تسجيلات', many: '{n} تسجيلًا', other: '{n} تسجيل' })} ${word}`,
  },
);

/** Shared components used on home and elsewhere. */
export const componentStrings = defineStrings(
  {
    // empty state
    emptyTitle: 'What would you like to count?',
    emptyBody: 'Tap one to start. You can add more any time with the + button.',
    makeMyOwn: 'Make my own',
    // ideas grid
    ideaAdded: (name: string) => `${name}, added`,
    ideaAdd: (name: string) => `Add ${name}`,
    // tap bubble
    bubbleHint: 'Double tap to add one. Swipe up or down with one finger for more options.',
    actionAdd: 'Add one',
    actionRemove: 'Take one away',
    actionOpen: 'Open details',
    takeOneAway: (name: string) => `Take one ${name} away`,
  },
  {
    emptyTitle: 'ماذا تحب أن تعُدّ؟',
    emptyBody: 'اختر واحدة للبدء. يمكنك إضافة المزيد في أي وقت بزر +.',
    makeMyOwn: 'أنشئ بنفسي',
    ideaAdded: (name) => `${name}، مُضاف`,
    ideaAdd: (name) => `إضافة ${name}`,
    bubbleHint: 'اضغط مرتين لإضافة واحدة. اسحب لأعلى أو لأسفل بإصبع واحد لخيارات أخرى.',
    actionAdd: 'إضافة واحدة',
    actionRemove: 'حذف واحدة',
    actionOpen: 'فتح التفاصيل',
    takeOneAway: (name) => `حذف واحدة من ${name}`,
  },
);
