/**
 * On-device question parser. A deliberately small rule-based translator from
 * English to QuerySpec. It handles the common shapes ("how many … last 30
 * days", "when do I … the most", "when did I last …") with zero latency and
 * no network, and is the fallback whenever the LLM is unavailable.
 */
import { MONTHS_LONG, addDays, dayKey, startOfDay } from '../time';
import type { GroupBy, Intent, QueryFilter, QuerySpec, RangeSpec } from './types';

export type CategoryLite = { id: string; name: string; emoji?: string };

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  'couple of': 2,
  couple: 2,
  few: 3,
  'a few': 3,
  several: 5,
};

const SYNONYM_GROUPS: string[][] = [
  ['smok', 'cigarett', 'cig', 'cigs', 'ciggi', 'vap', 'nicotin', 'tobacco', 'shisha', 'hookah', 'argil'],
  ['coffe', 'espresso', 'latt', 'cappuccino', 'caffein', 'americano', 'flat white'],
  ['alcohol', 'beer', 'wine', 'booz', 'cocktail', 'drunk'],
  ['water', 'hydrat'],
  ['exercis', 'workout', 'gym', 'train', 'lift', 'sport'],
  ['run', 'jog'],
  ['walk', 'step'],
  ['medic', 'med', 'meds', 'pill', 'tablet', 'dose'],
  ['headach', 'migrain', 'head pain'],
  ['eat out', 'eating out', 'ate out', 'restaurant', 'takeaway', 'takeout', 'delivery'],
  ['read', 'book', 'pag'],
  ['meditat', 'mindful'],
  ['tea', 'chai'],
  ['snack', 'junk', 'sweet', 'candy', 'chocolat'],
  ['sleep', 'nap'],
];

/** Words that never identify a category. */
const STOPWORDS = new Set(
  (
    'how many much times time did do does i me my we you the a an in on at of for to from with and or ' +
    'what when which was were is are been be have has had it this that these those last past previous ' +
    'ever total overall all most more less fewer than average per day days week weeks month months year years ' +
    'today yesterday tonight morning afternoon evening night weekend weekends weekday weekdays hour hours ' +
    'often usually typically compare compared vs versus first latest recent since ago long longest streak ' +
    'row consecutive gap break without show list tell can could please about around between before after ' +
    'busiest peak number count counts counted log logged track tracked go went gone so far straight biggest ' +
    'there any anything everything things thing stuff habit habits category categories moments moment events event ' +
    'happen happened happens o clock oclock am pm start started begin began ' +
    MONTHS_LONG.join(' ').toLowerCase() +
    ' jan feb mar apr jun jul aug sep sept oct nov dec monday tuesday wednesday thursday friday saturday sunday ' +
    'mondays tuesdays wednesdays thursdays fridays saturdays sundays daily weekly monthly while doing done get got take took had have'
  ).split(/\s+/),
);

const GENERIC =
  /\b(anything|everything|things|stuff|all|overall|in total|habits?|categor(y|ies)|moments?|events?|logged)\b/;

export function stem(word: string): string {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length > 4 && w.endsWith('ies')) w = w.slice(0, -3) + 'y';
  else if (w.length > 4 && w.endsWith('es') && !w.endsWith('ses')) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2);
  if (w.length > 4 && w.endsWith('e')) w = w.slice(0, -1);
  return w;
}

function stemsMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  return s.length >= 4 && l.startsWith(s);
}

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-zÀ-ɏ]+/)
    .filter(Boolean);
}

/** Which synonym groups a phrase belongs to */
function groupsFor(text: string): number[] {
  const lowered = text.toLowerCase();
  const st = tokens(lowered).map(stem);
  const out: number[] = [];
  SYNONYM_GROUPS.forEach((g, i) => {
    if (g.some((term) => (term.includes(' ') ? lowered.includes(term) : st.some((s) => stemsMatch(s, term))))) {
      out.push(i);
    }
  });
  return out;
}

export function matchCategories(question: string, categories: CategoryLite[]): string[] {
  const q = question.toLowerCase();
  const qStems = tokens(q)
    .filter((t) => !STOPWORDS.has(t))
    .map(stem);
  const qGroups = new Set(groupsFor(q));
  const hits: string[] = [];
  for (const c of categories) {
    const nameTokens = tokens(c.name).filter((t) => t.length >= 3 && !STOPWORDS.has(t));
    const direct =
      (c.emoji && c.emoji.trim() && q.includes(c.emoji.trim())) ||
      q.includes(c.name.toLowerCase()) ||
      nameTokens.some((t) => qStems.some((s) => stemsMatch(stem(t), s)));
    const viaSynonym = groupsFor(c.name).some((g) => qGroups.has(g));
    if (direct || viaSynonym) hits.push(c.id);
  }
  return hits;
}

/** Content words in the question that look like a subject ("beer"). */
function subjectWords(rest: string): string[] {
  return tokens(rest).filter((t) => t.length >= 3 && !STOPWORDS.has(t) && !(t in NUMBER_WORDS));
}

function parseNumber(s: string): number | null {
  const t = s.trim().toLowerCase();
  if (/^\d+$/.test(t)) return Number(t);
  return NUMBER_WORDS[t] ?? null;
}

type Found = { spec: RangeSpec; start: number; end: number };

const MONTH_RE =
  /\b(?:in |during |for )?(january|february|march|april|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)(?: (\d{4}))?\b|\b(?:in|during) (may)(?: (\d{4}))?\b/g;
const MONTH_INDEX: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  sept: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function findRanges(q: string, now: Date): Found[] {
  const found: Found[] = [];
  const add = (spec: RangeSpec, m: RegExpExecArray) => {
    // ignore overlaps with an earlier, longer match
    if (found.some((f) => m.index < f.end && m.index + m[0].length > f.start)) return;
    found.push({ spec, start: m.index, end: m.index + m[0].length });
  };
  const each = (re: RegExp, fn: (m: RegExpExecArray) => RangeSpec | null) => {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(q))) {
      const spec = fn(m);
      if (spec) add(spec, m);
    }
  };

  // "last 30 days", "past two weeks", "previous 3 months", "last 24 hours"
  each(
    /\b(?:in |over |during |for |within )?(?:the )?(?:last|past|previous) (\d+|a couple of|couple of|a few|few|several|an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty) (hour|day|week|month|year)s?\b/g,
    (m) => {
      const n = parseNumber(m[1]) ?? 1;
      const unit = m[2];
      const days =
        unit === 'hour'
          ? Math.max(1, Math.ceil(n / 24))
          : unit === 'day'
            ? n
            : unit === 'week'
              ? n * 7
              : unit === 'month'
                ? n * 30
                : n * 365;
      return { preset: 'last_n_days', n: days };
    },
  );
  // "past week" (rolling) vs "last week" (calendar)
  each(/\b(?:in |over |during |for )?(?:the )?past (day|week|month|year)\b/g, (m) => ({
    preset: 'last_n_days',
    n: { day: 1, week: 7, month: 30, year: 365 }[m[1]] ?? 7,
  }));
  each(/\b(?:in |during |for )?(?:the )?(?:last|previous) (week|month|year)\b/g, (m) => ({
    preset: m[1] === 'week' ? 'last_week' : m[1] === 'month' ? 'last_month' : 'last_year',
  }));
  each(
    /\b(?:in |during |for )?(?:the )?(?:this|current) (week|month|year)\b|\bso far this (week|month|year)\b/g,
    (m) => {
      const u = m[1] ?? m[2];
      return { preset: u === 'week' ? 'this_week' : u === 'month' ? 'this_month' : 'this_year' };
    },
  );
  each(/\b(today|tonight|this morning|this afternoon|this evening|so far today)\b/g, () => ({ preset: 'today' }));
  each(/\b(yesterday|last night)\b/g, () => ({ preset: 'yesterday' }));
  each(/\b(ever|all[- ]time|in total|overall|since (?:i )?(?:start(?:ed)?|began|the beginning))\b/g, () => ({
    preset: 'all_time',
  }));
  // "last friday", "on monday" (singular → a specific recent date)
  each(/\b(?:last|on|this past) (monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b(?!s)/g, (m) => {
    const target = WEEKDAY_INDEX[m[1]];
    let d = startOfDay(now);
    const isLast = m[0].startsWith('last');
    for (let i = 0; i < 8; i++) {
      if (d.getDay() === target && (!isLast || i > 0)) break;
      d = addDays(d, -1);
    }
    const k = dayKey(d);
    return { from: k, to: k };
  });
  // months
  each(MONTH_RE, (m) => {
    const name = m[1] ?? m[3];
    const yearText = m[1] ? m[2] : m[4];
    const idx = MONTH_INDEX[name.slice(0, 3)];
    if (idx === undefined) return null;
    let year = yearText ? Number(yearText) : now.getFullYear();
    if (!yearText && idx > now.getMonth()) year -= 1;
    const from = new Date(year, idx, 1);
    const to = new Date(year, idx + 1, 0);
    return { from: dayKey(from), to: dayKey(to) };
  });

  return found.sort((a, b) => a.start - b.start);
}

function to24(h: number, ampm?: string): number {
  if (!ampm) return h;
  if (ampm === 'am') return h === 12 ? 0 : h;
  return h === 12 ? 12 : h + 12;
}

function findFilter(q: string): QueryFilter | undefined {
  const f: QueryFilter = {};
  if (/\bweekends?\b/.test(q)) f.weekdays = [0, 6];
  else if (/\bweekdays\b|\bon weekdays\b|\bworkdays?\b/.test(q)) f.weekdays = [1, 2, 3, 4, 5];
  else {
    const days = [...q.matchAll(/\b(?:on )?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)s\b/g)].map(
      (m) => WEEKDAY_INDEX[m[1]],
    );
    if (days.length) f.weekdays = days;
  }

  if (/\b(in the )?mornings?\b|\bthis morning\b/.test(q)) Object.assign(f, { hourFrom: 5, hourTo: 12 });
  else if (/\b(in the )?afternoons?\b/.test(q)) Object.assign(f, { hourFrom: 12, hourTo: 17 });
  else if (/\b(in the )?evenings?\b/.test(q)) Object.assign(f, { hourFrom: 17, hourTo: 22 });
  else if (/\b(at )?nights?\b|\blate\b|\btonight\b/.test(q)) Object.assign(f, { hourFrom: 22, hourTo: 5 });

  const after = /\bafter (\d{1,2})(?::\d{2})? ?(am|pm)?\b/.exec(q);
  const before = /\bbefore (\d{1,2})(?::\d{2})? ?(am|pm)?\b|\bbefore (noon|midnight)\b/.exec(q);
  if (after) f.hourFrom = to24(Number(after[1]) % 24, after[2]);
  if (before) {
    if (before[3]) f.hourTo = before[3] === 'noon' ? 12 : 24;
    else f.hourTo = to24(Number(before[1]) % 24, before[2]);
  }
  if (after && !before) f.hourTo = 24;
  if (before && !after) f.hourFrom = 0;

  return Object.keys(f).length ? f : undefined;
}

function detectIntent(
  q: string,
  rest: string,
  rangeCount: number,
): { intent: Intent; groupBy?: GroupBy; per?: 'day' | 'week' | 'month' } {
  if (
    /\b(compare|compared|comparison|vs\.?|versus)\b/.test(q) ||
    /\b(more|less|fewer) than (last|the previous|previous|usual)\b/.test(q) ||
    (rangeCount >= 2 && /\bor\b/.test(q))
  ) {
    return { intent: 'compare' };
  }
  if (/\bstreaks?\b|\bin a row\b|\bconsecutive\b|\bstraight days\b/.test(q)) return { intent: 'streak' };
  if (/\b(gap|gaps|break|breaks|went without|gone without|go without|without)\b/.test(q)) return { intent: 'gap' };
  if (
    /\b(last time|when did i last|when was (?:the|my) last|most recent(?:ly)?|latest|how long since|how long ago|since (?:i )?last)\b/.test(
      q,
    )
  ) {
    return { intent: 'last' };
  }
  if (/\b(first time|when did i (?:first|start|begin)|first ever|earliest|when was (?:the|my) first)\b/.test(q)) {
    return { intent: 'first' };
  }
  const perM = /\bper (day|week|month)\b|\ba (day|week|month)\b|\b(daily|weekly|monthly)\b/.exec(q);
  if (
    /\b(average|avg|on average|mean|typically how many|usually how many|how many .* (per|a) (day|week|month))\b/.test(
      q,
    ) ||
    (perM && /\bhow many|how often\b/.test(q))
  ) {
    const raw = perM ? (perM[1] ?? perM[2] ?? perM[3]) : 'day';
    const per = raw.startsWith('week') ? 'week' : raw.startsWith('month') ? 'month' : 'day';
    return { intent: 'average', per };
  }
  if (
    /\b(which|what) (habit|category|thing|activity|one)\b|\bwhat (do|did) i (do|log|track)\b|\bbreakdown\b|\brank(ing)?\b|\btop (categories|habits|things)\b/.test(
      q,
    )
  ) {
    return { intent: 'ranking' };
  }
  const peakish =
    /\b(most|usually|typically|busiest|peak|heaviest|worst|mostly|tend to|more often)\b/.test(q) ||
    /\bwhat time\b|\bwhich (hour|day|month|week)\b|\bwhat (hour|day|month)\b/.test(q);
  if (peakish && /\b(when|what time|which|what|busiest|peak|heaviest|worst|tend)\b/.test(q)) {
    let groupBy: GroupBy | undefined;
    if (/\b(time|hour|o'?clock|time of day)\b/.test(rest)) groupBy = 'hour';
    else if (/\b(day of (the )?week|weekday)\b/.test(rest)) groupBy = 'weekday';
    else if (/\b(which|what) day\b|\bbusiest day\b|\bheaviest day\b|\bworst day\b|\bdate\b/.test(rest)) groupBy = 'day';
    else if (/\bmonth\b/.test(rest)) groupBy = 'month';
    else if (/\bweek\b/.test(rest)) groupBy = 'week';
    return { intent: 'peak', groupBy };
  }
  if (/\b(list|show me|show|what times|at what times?|which times|when did i)\b/.test(q)) return { intent: 'list' };
  return { intent: 'count' };
}

const DEFAULT_RANGE: Record<Intent, RangeSpec> = {
  count: { preset: 'all_time' },
  peak: { preset: 'all_time' },
  last: { preset: 'all_time' },
  first: { preset: 'all_time' },
  average: { preset: 'last_n_days', n: 30 },
  compare: { preset: 'this_week' },
  streak: { preset: 'all_time' },
  gap: { preset: 'all_time' },
  list: { preset: 'last_n_days', n: 7 },
  ranking: { preset: 'last_n_days', n: 30 },
};

export function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[?!.,;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseQuestion(question: string, categories: CategoryLite[], now: Date = new Date()): QuerySpec {
  const q = normalizeQuestion(question);
  const ranges = findRanges(q, now);
  // text with time phrases removed, used for groupBy and subject detection
  let rest = q;
  for (const r of [...ranges].reverse()) rest = rest.slice(0, r.start) + ' ' + rest.slice(r.end);

  const { intent, groupBy, per } = detectIntent(q, rest, ranges.length);
  const categoryIds = intent === 'ranking' ? [] : matchCategories(q, categories);

  let unmatched: string | undefined;
  if (!categoryIds.length && intent !== 'ranking' && !GENERIC.test(q)) {
    const subjects = subjectWords(rest);
    if (subjects.length) unmatched = subjects[0];
  }

  const range = ranges[0]?.spec ?? DEFAULT_RANGE[intent];
  const spec: QuerySpec = { intent, categoryIds, range };
  if (intent === 'compare' && ranges[1]) spec.compareTo = ranges[1].spec;
  if (groupBy) spec.groupBy = groupBy;
  if (per) spec.per = per;
  const filter = findFilter(q);
  if (filter) spec.filter = filter;
  if (unmatched) spec.unmatched = unmatched;
  return spec;
}

/** Example questions built from the user's own categories. */
export function suggestQuestions(categories: CategoryLite[]): string[] {
  if (!categories.length) return [];
  const [a, b = a, c = a] = categories.map((x) => x.name.toLowerCase());
  return [
    `How many times did I log ${a} in the last 30 days?`,
    `What time of day do I log ${a} most?`,
    `When was the last time I logged ${b}?`,
    `Compare ${c} this week vs last week`,
    `Which habit did I log most this month?`,
    `Longest break from ${a}?`,
  ];
}
