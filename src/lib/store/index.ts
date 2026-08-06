import { createFileStore, DEFAULT_FILE } from './jsonfile';
import { createPostgresStore } from './postgres';
import type { Store } from './types';
import { normalizeDatabaseUrl } from './url';

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

  const raw = process.env.DATABASE_URL ?? '';
  if (raw.trim()) {
    const result = normalizeDatabaseUrl(raw);
    if (!result.ok) throw new Error(result.message);
    if (result.repaired) {
      // Worked around a quoted value or a pasted `psql …` command. Fine to run
      // with, but say so once — the stored value should be corrected at source.
      console.warn('[connect] DATABASE_URL needed cleaning up (stray quotes or a "psql " prefix).');
    }
    cached = createPostgresStore(result.url);
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
