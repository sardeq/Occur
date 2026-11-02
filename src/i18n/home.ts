import { defineStrings } from '@/lib/i18n';

/** Home screen (app/index.tsx) and the pieces only it uses. */
export const homeStrings = defineStrings(
  {
    syncOffline: 'Offline, changes saved on device',
    syncing: 'Syncing',
    insights: 'Insights',
    settings: 'Settings',
    settingsA11y: 'Settings and account',

    tips: 'Tips',
    hideTipsA11y: 'Hide tips. You can turn them back on in Settings',
    tipAddList: 'Tap + to add one',
    tipAddBubbles: 'Tap a bubble to add one',
    tipRemoveList: 'Tap − to take one away',
    tipRemoveBubbles: 'Mistake? Tap − or swipe down',
    tipOpenList: 'Tap a name for details',
    tipOpenBubbles: 'Hold a bubble for details',

    emptyQuiet: (word: string) => `Everything's had a turn ${word}.`,
    emptyNothing: (word: string) => `Nothing logged ${word} yet.`,
    showEverything: 'Show everything',
    addSomething: 'Add something to count',
    add: 'Add',

    bubbleNever: (name: string) => `${name}, never logged`,
    bubbleLastAgo: (name: string, since: string) => `${name}, last one ${since} ago`,
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
  },
  {
    syncOffline: 'غير متصل، التغييرات محفوظة على الجهاز',
    syncing: 'جارٍ المزامنة',
    insights: 'الإحصاءات',
    settings: 'الإعدادات',
    settingsA11y: 'الإعدادات والحساب',

    tips: 'نصائح',
    hideTipsA11y: 'إخفاء النصائح. يمكنك إعادتها من الإعدادات',
    tipAddList: 'اضغط + لإضافة واحدة',
    tipAddBubbles: 'اضغط على فقاعة لإضافة واحدة',
    tipRemoveList: 'اضغط − لحذف واحدة',
    tipRemoveBubbles: 'أخطأت؟ اضغط − أو اسحب للأسفل',
    tipOpenList: 'اضغط على الاسم لعرض التفاصيل',
    tipOpenBubbles: 'اضغط مطولًا على فقاعة لعرض التفاصيل',

    emptyQuiet: (word) => `كل شيء أخذ نصيبه ${word}.`,
    emptyNothing: (word) => `لم يُسجَّل شيء ${word} بعد.`,
    showEverything: 'عرض الكل',
    addSomething: 'أضف شيئًا لعدّه',
    add: 'إضافة',

    bubbleNever: (name) => `${name}، لم يُسجَّل أبدًا`,
    bubbleLastAgo: (name, since) => `${name}، آخر مرة قبل ${since}`,
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
  },
);

/** Shared components used on home and elsewhere. */
export const componentStrings = defineStrings(
  {
    // filter bar
    all: 'All',
    showEverything: 'Show everything',
    top: (n: number) => `Top ${n}`,
    topA11y: (n: number) => `Only the ${n} most active`,
    quiet: 'Quiet',
    quietA11y: 'Only things with nothing logged in this period',
    doingMore: 'Doing more',
    doingMoreA11y: 'Only things you want to do more',
    cuttingBack: 'Cutting back',
    cuttingBackA11y: 'Only things you want to do less',
    chipA11y: (on: boolean, name: string, n: number) => `${on ? 'Hide' : 'Show'} ${name}, ${n}`,
    // filter card
    openDetails: (name: string) => `Open ${name} details`,
    more: 'More',
    periodChart: (name: string) => `${name} per period chart`,
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
    all: 'الكل',
    showEverything: 'عرض الكل',
    top: (n) => `الأعلى ${n}`,
    topA11y: (n) => `فقط الأكثر نشاطًا (${n})`,
    quiet: 'الهادئة',
    quietA11y: 'فقط ما لم يُسجَّل في هذه الفترة',
    doingMore: 'للزيادة',
    doingMoreA11y: 'فقط ما تريد فعله أكثر',
    cuttingBack: 'للتقليل',
    cuttingBackA11y: 'فقط ما تريد التقليل منه',
    chipA11y: (on, name, n) => `${on ? 'إخفاء' : 'عرض'} ${name}، ${n}`,
    openDetails: (name) => `فتح تفاصيل ${name}`,
    more: 'المزيد',
    periodChart: (name) => `رسم ${name} حسب الفترة`,
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
