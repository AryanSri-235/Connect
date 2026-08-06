/**
 * Normalising DATABASE_URL before it reaches the driver.
 *
 * The value arrives from a dashboard field where people paste whatever the
 * database provider handed them. Two forms are almost universal and neither
 * parses as a URL:
 *
 *   'postgresql://…'         quotes copied from a .env file
 *   psql 'postgresql://…'    Neon's Connect button gives a whole shell command
 *
 * The driver's only complaint for either is "Invalid URL", which says nothing
 * about the cause. Accept both, and when the value really is unusable, describe
 * what we got — with the password removed.
 */

export interface UrlOk {
  ok: true;
  url: string;
  /** True when we had to repair the input; worth surfacing so it gets fixed at source. */
  repaired: boolean;
}

export interface UrlError {
  ok: false;
  message: string;
}

/** Hide the password so an error message can be shown or logged safely. */
export function maskDatabaseUrl(value: string): string {
  const masked = value.replace(/(:\/\/[^:/@]+:)[^@]*(@)/, '$1••••$2');
  return masked.length > 120 ? `${masked.slice(0, 117)}…` : masked;
}

export function normalizeDatabaseUrl(raw: string): UrlOk | UrlError {
  const original = raw;
  let value = raw.trim();

  // A pasted shell command: psql 'postgres://…'
  value = value.replace(/^psql\s+/i, '').trim();

  // One layer of wrapping quotes.
  const quoted =
    (value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'));
  if (quoted && value.length >= 2) value = value.slice(1, -1).trim();

  // Line breaks from a wrapped copy-paste. Spaces are left alone — they'd be
  // inside a password, where removing them would silently change the credential.
  value = value.replace(/[\r\n\t]/g, '');

  if (!value) {
    return { ok: false, message: 'DATABASE_URL is set but empty.' };
  }

  if (!/^postgres(ql)?:\/\//i.test(value)) {
    const scheme = value.match(/^([a-z][a-z0-9+.-]*):\/\//i)?.[1];
    return {
      ok: false,
      message: scheme
        ? `DATABASE_URL must start with "postgresql://", but it starts with "${scheme}://". Received: ${maskDatabaseUrl(value)}`
        : `DATABASE_URL is not a connection string. It must start with "postgresql://". Received: ${maskDatabaseUrl(value)}`,
    };
  }

  try {
    const parsed = new URL(value);
    if (!parsed.hostname) {
      return { ok: false, message: `DATABASE_URL has no host. Received: ${maskDatabaseUrl(value)}` };
    }
  } catch {
    return {
      ok: false,
      message: `DATABASE_URL could not be parsed as a URL. Received: ${maskDatabaseUrl(value)}`,
    };
  }

  return { ok: true, url: value, repaired: value !== original.trim() };
}
