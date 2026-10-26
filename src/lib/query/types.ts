/**
 * The tiny query language that sits between a natural-language question and
 * the user's data.
 *
 * A question is first *translated* into a QuerySpec (by an LLM or by the
 * on-device rule parser), and the spec is then *executed* deterministically
 * against the stored events. The model never sees the event log and never
 * does arithmetic, so the numbers in an answer are always exact.
 */

export type Intent =
  | 'count' // how many times
  | 'peak' // when the most (hour / weekday / day / week / month)
  | 'last' // when was the last time
  | 'first' // when was the first time
  | 'average' // how many per day / week / month
  | 'compare' // period A vs period B
  | 'streak' // consecutive days with at least one event
  | 'gap' // longest break without
  | 'list' // show me the times
  | 'ranking'; // which category the most

export type RangePreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'last_year'
  | 'all_time'
  | 'last_n_days';

/** Dates are local calendar days, `YYYY-MM-DD`, both ends inclusive. */
export type RangeSpec = { preset: RangePreset; n?: number } | { from: string; to: string };

export type GroupBy = 'hour' | 'weekday' | 'day' | 'week' | 'month';

export type QueryFilter = {
  /** 0 = Sunday … 6 = Saturday */
  weekdays?: number[];
  /** inclusive start hour, 0-23 */
  hourFrom?: number;
  /** exclusive end hour, 1-24. May be < hourFrom to wrap past midnight. */
  hourTo?: number;
};

export type QuerySpec = {
  intent: Intent;
  /** empty = all categories */
  categoryIds: string[];
  range: RangeSpec;
  compareTo?: RangeSpec;
  groupBy?: GroupBy;
  per?: 'day' | 'week' | 'month';
  filter?: QueryFilter;
  /** the thing the user asked about when it matches none of their categories */
  unmatched?: string;
};

export type ChartKind = 'hour' | 'weekday' | 'bars';

export type AnswerChart = {
  kind: ChartKind;
  values: number[];
  labels: string[];
  highlight?: number;
  /** palette key, so the chart can match the category bubble */
  color?: string;
};

export type Answer = {
  /** The big number / word shown on the card. */
  headline: string;
  /** Small caption under the headline. */
  caption?: string;
  /** One or two plain sentences. */
  sentence: string;
  chart?: AnswerChart;
  /** Human readable chips: what the question was understood as. */
  interpretation: string[];
  source: 'ai' | 'device';
  spec: QuerySpec;
};
