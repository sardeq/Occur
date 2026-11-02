import { defineStrings } from '../lib/i18n';

/** Ask screen (src/app/ask.tsx). */
export const askStrings = defineStrings(
  {
    placeholder: 'How many times did I…',
    questionA11y: 'Question',
    send: 'Ask',
    close: 'Close',
    intro: 'Ask in your own words — how many, when, how often, compared to when.',
    introEmpty: 'Add a bubble and log a few things first, then ask me about them.',
    privacy:
      'Every number is counted on your phone from your own log. The AI only ever sees your question and the names of your bubbles — never your history.',
    thinking: 'Looking through your log…',
    sourceAi: 'AI read the question',
    sourceDevice: 'Parsed on device',
    aiSignedOut: 'AI needs sign-in',
    aiUnavailable: 'AI unavailable',
    error: 'Something went wrong.',
  },
  {
    placeholder: 'كم مرة…',
    questionA11y: 'السؤال',
    send: 'اسأل',
    close: 'إغلاق',
    intro: 'اسأل بكلماتك — كم مرة، ومتى، وكم مرة في الأسبوع، ومقارنةً بأي فترة.',
    introEmpty: 'أضف فقاعة وسجّل بعض الأشياء أولًا، ثم اسألني عنها.',
    privacy:
      'كل رقم يُحسب على هاتفك من سجلّك أنت. الذكاء الاصطناعي لا يرى إلا سؤالك وأسماء فقاعاتك — ولا يرى سجلّك أبدًا.',
    thinking: 'أبحث في سجلّك…',
    sourceAi: 'قرأ الذكاء الاصطناعي السؤال',
    sourceDevice: 'فُهم على الجهاز',
    aiSignedOut: 'الذكاء الاصطناعي يتطلب تسجيل الدخول',
    aiUnavailable: 'الذكاء الاصطناعي غير متاح',
    error: 'حدث خطأ ما.',
  },
);
