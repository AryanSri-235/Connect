import type { Day } from '../date';
import type { Checkin, DailyStat, Person, PersonInput, Profile } from '../types';

/**
 * The persistence contract. Two drivers implement it: Postgres (production) and
 * a JSON file (local dev, zero setup). Keep it small — every method added here
 * has to be written twice.
 */
export interface Store {
  readonly kind: 'postgres' | 'file';

  listPeople(): Promise<Person[]>;
  /** Replace the roster: upserts everything given, deletes anyone omitted. */
  savePeople(people: PersonInput[]): Promise<Person[]>;

  getStats(from: Day, to: Day): Promise<DailyStat[]>;
  saveStats(rows: DailyStat[]): Promise<void>;

  getCheckins(from: Day, to: Day): Promise<Checkin[]>;
  saveCheckin(checkin: Omit<Checkin, 'updatedAt'>): Promise<Checkin>;

  getProfiles(): Promise<Profile[]>;
  saveProfile(profile: Profile): Promise<void>;

  getMeta(key: string): Promise<string | null>;
  setMeta(key: string, value: string): Promise<void>;
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
