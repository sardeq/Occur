export type Goal = 'track' | 'more' | 'less';

export type Category = {
  id: string;
  name: string;
  emoji: string;
  /** palette key, see src/theme/palette.ts */
  color: string;
  goal: Goal;
  trackLocation: boolean;
  createdAt: string;
  updatedAt?: string;
};

export type EventSource = 'tap' | 'manual' | 'import';

export type OccurEvent = {
  id: string;
  categoryId: string;
  /** ISO timestamp */
  occurredAt: string;
  tz?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  place?: string | null;
  note?: string | null;
  source: EventSource;
};
