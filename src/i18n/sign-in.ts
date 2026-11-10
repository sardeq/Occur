import { defineStrings } from '@/lib/i18n';

export const signInStrings = defineStrings(
  {
    coffee: 'Coffee',
    water: 'Water',
    reading: 'Reading',
    tagline: 'Click. Click. Done.',
    pitch:
      'Make a bubble for anything you want to count. Tap it when it happens — Occur remembers when, and answers your questions about it later.',
    google: 'Continue with Google',
    guest: 'Try it without an account',
    guestHint: 'No account? Explore with sample data — it stays on this phone.',
    noBackendHint: 'Runs with sample data on this phone. Google sign-in turns on once Firebase keys are in .env.',
    error: 'Something went wrong. Please try again.',
  },
  {
    coffee: 'قهوة',
    water: 'ماء',
    reading: 'قراءة',
    tagline: 'نقرة. نقرة. تم.',
    pitch: 'أنشئ فقاعة لأي شيء تريد عدّه. انقر عليها عندما يحدث — يتذكّر Occur الوقت، ويجيب عن أسئلتك حوله لاحقًا.',
    google: 'المتابعة بحساب Google',
    guest: 'جرّبه بلا حساب',
    guestHint: 'ليس لديك حساب؟ استكشف ببيانات تجريبية — تبقى على هذا الهاتف.',
    noBackendHint:
      'يعمل ببيانات تجريبية على هذا الهاتف. يُفعَّل تسجيل الدخول بحساب Google بعد إضافة مفاتيح Firebase إلى ملف ‎.env.',
    error: 'حدث خطأ ما. حاول مرة أخرى.',
  },
);
