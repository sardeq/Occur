import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { executeQuery } from '../src/lib/query/execute';
import { parseQuestion } from '../src/lib/query/parse-local';
import { sanitizeSpec } from '../src/lib/query/sanitize';
import { periodStats, streaks, gaps } from '../src/lib/stats';
import type { Category, OccurEvent } from '../src/lib/types';

// Monday 26 Oct 2026, 18:00 local
const NOW = new Date(2026, 9, 26, 18, 0, 0);

const cats: Category[] = [
  { id: 'smoke', name: 'Smoking', emoji: '🚬', color: 'slate', goal: 'less', trackLocation: false, createdAt: '' },
  { id: 'coffee', name: 'Coffee', emoji: '☕', color: 'apricot', goal: 'track', trackLocation: false, createdAt: '' },
  { id: 'read', name: 'Reading', emoji: '📖', color: 'sky', goal: 'more', trackLocation: false, createdAt: '' },
];

let seq = 0;
function ev(categoryId: string, d: Date): OccurEvent {
  return { id: `e${seq++}`, categoryId, occurredAt: d.toISOString(), source: 'tap' };
}
const at = (daysAgo: number, h: number, m = 0) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(h, m, 0, 0);
  return d;
};

// Smoking: 3 a day at 9:00, 14:00, 21:00 for the last 40 days, plus an extra 21:30 on Fridays
const events: OccurEvent[] = [];
for (let i = 40; i >= 0; i--) {
  for (const h of [9, 14, 21]) {
    const d = at(i, h);
    if (d <= NOW) events.push(ev('smoke', d));
  }
  if (at(i, 0).getDay() === 5) events.push(ev('smoke', at(i, 21, 30)));
  events.push(ev('coffee', at(i, 8)));
}
events.push(ev('read', at(10, 22)));
events.push(ev('read', at(3, 22)));
events.sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));

const ask = (q: string) => executeQuery(parseQuestion(q, cats, NOW), { categories: cats, events, now: NOW });

describe('parser', () => {
  it('handles the brief example: last 30 days', () => {
    const s = parseQuestion('How many times did I smoke in the last 30 days?', cats, NOW);
    assert.equal(s.intent, 'count');
    assert.deepEqual(s.categoryIds, ['smoke']);
    assert.deepEqual(s.range, { preset: 'last_n_days', n: 30 });
  });

  it('handles the brief example: when the most', () => {
    const s = parseQuestion('When did I smoke the most?', cats, NOW);
    assert.equal(s.intent, 'peak');
    assert.deepEqual(s.categoryIds, ['smoke']);
    assert.equal(s.groupBy, undefined);
  });

  it('matches synonyms', () => {
    assert.deepEqual(parseQuestion('how many cigarettes this week', cats, NOW).categoryIds, ['smoke']);
    assert.deepEqual(parseQuestion('lattes today?', cats, NOW).categoryIds, ['coffee']);
    assert.deepEqual(parseQuestion('how many books did I read', cats, NOW).categoryIds, ['read']);
  });

  it('detects intents', () => {
    assert.equal(parseQuestion('When was the last time I smoked?', cats, NOW).intent, 'last');
    assert.equal(parseQuestion('What time of day do I drink coffee most?', cats, NOW).groupBy, 'hour');
    assert.equal(parseQuestion('Which day of the week do I smoke most', cats, NOW).groupBy, 'weekday');
    assert.equal(parseQuestion('average coffee per day this month', cats, NOW).intent, 'average');
    assert.equal(parseQuestion('compare smoking this week vs last week', cats, NOW).intent, 'compare');
    assert.equal(parseQuestion('longest break from smoking', cats, NOW).intent, 'gap');
    assert.equal(parseQuestion('reading streak', cats, NOW).intent, 'streak');
    assert.equal(parseQuestion('Which habit did I log most this month?', cats, NOW).intent, 'ranking');
  });

  it('parses calendar ranges and filters', () => {
    assert.deepEqual(parseQuestion('coffee last month', cats, NOW).range, { preset: 'last_month' });
    assert.deepEqual(parseQuestion('coffee past week', cats, NOW).range, { preset: 'last_n_days', n: 7 });
    assert.deepEqual(parseQuestion('coffee in september', cats, NOW).range, { from: '2026-09-01', to: '2026-09-30' });
    assert.deepEqual(parseQuestion('coffee in november', cats, NOW).range, { from: '2025-11-01', to: '2025-11-30' });
    assert.deepEqual(parseQuestion('how many cigarettes at night on weekends', cats, NOW).filter, {
      weekdays: [0, 6],
      hourFrom: 22,
      hourTo: 5,
    });
    const two = parseQuestion('compare coffee this month vs last month', cats, NOW);
    assert.deepEqual(two.range, { preset: 'this_month' });
    assert.deepEqual(two.compareTo, { preset: 'last_month' });
  });

  it('flags things the user does not track', () => {
    const s = parseQuestion('How many beers did I have this week?', cats, NOW);
    assert.equal(s.unmatched, 'beers');
    assert.match(ask('How many beers did I have this week?').sentence, /don't count/);
  });
});

describe('executor', () => {
  it('counts exactly', () => {
    // last 30 days = today + 29 previous days. Today (18:00) has 9:00 and 14:00 → 2.
    const a = ask('How many times did I smoke in the last 30 days?');
    const fridays = Array.from({ length: 30 }, (_, i) => at(i, 0)).filter((d) => d.getDay() === 5).length;
    assert.equal(a.headline, String(29 * 3 + 2 + fridays));
  });

  it('finds the peak hour', () => {
    const a = ask('What time do I smoke the most?');
    assert.equal(a.spec.groupBy, 'hour');
    assert.equal(a.chart?.highlight, 21);
  });

  it('finds the peak weekday', () => {
    const a = ask('Which day of the week do I smoke most?');
    assert.equal(a.headline, 'Fridays');
  });

  it('answers last time', () => {
    const a = ask('When was the last time I smoked?');
    assert.match(a.sentence, /today/);
    assert.match(a.sentence, /4h/);
  });

  it('compares the current week with the same point last week', () => {
    // Monday 18:00: this week = today's 9:00 + 14:00 smokes; last week by Monday 18:00 = 2 as well
    const a = ask('compare smoking this week vs last week');
    assert.equal(a.headline, '2 vs 2');
    assert.match(a.sentence, /by this point/);
  });

  it('ranks categories', () => {
    const a = ask('Which habit did I log most this month?');
    assert.match(a.headline, /Smoking/);
  });

  it('rejects hallucinated category ids from a model', () => {
    assert.equal(sanitizeSpec({ intent: 'count', categoryIds: ['nope'], range: { preset: 'today' } }, ['smoke']), null);
    const ok = sanitizeSpec({ intent: 'count', categoryIds: ['smoke'], range: { preset: 'last_n_days', n: '7' } }, [
      'smoke',
    ]);
    assert.deepEqual(ok, { intent: 'count', categoryIds: ['smoke'], range: { preset: 'last_n_days', n: 7 } });
    assert.equal(sanitizeSpec({ intent: 'drop table', categoryIds: [] }, ['smoke']), null);
  });
});

describe('stats', () => {
  it('compares to the same point of the previous period', () => {
    const smoke = events.filter((e) => e.categoryId === 'smoke');
    const s = periodStats(smoke, NOW);
    assert.equal(s.today, 2);
    assert.equal(s.todayPrev, 2); // yesterday up to 18:00
  });

  it('computes streaks and gaps', () => {
    const read = events.filter((e) => e.categoryId === 'read');
    assert.equal(streaks(read, NOW).longest, 1);
    const g = gaps(read, NOW);
    assert.equal(Math.round(g.longestMs / 86_400_000), 7);
  });
});
