import { createFileStore, DEFAULT_FILE } from './jsonfile';
import { createPostgresStore } from './postgres';
import type { Store } from './types';

export type { Store } from './types';

let cached: Store | null = null;

/**
 * Picks the driver: Postgres when DATABASE_URL is set, otherwise a local JSON
 * file. The file driver is refused on serverless hosts, where the filesystem is
 * read-only and per-instance — silently losing every write would be worse than
 * failing loudly here.
 */
export function getStore(): Store {
  if (cached) return cached;

  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    cached = createPostgresStore(url);
    return cached;
  }

  const serverless = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME;
  if (serverless) {
    throw new Error(
      'DATABASE_URL is not set. The local JSON store cannot be used on a serverless host ' +
        '(read-only, per-instance filesystem). Add a Postgres connection string in your project settings.',
    );
  }

  cached = createFileStore(process.env.DATA_FILE || DEFAULT_FILE);
  return cached;
}
