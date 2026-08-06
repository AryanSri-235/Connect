import { cookies } from 'next/headers';
import { getStore } from './store';

export const AUTH_COOKIE = 'connect_auth';
export const ME_COOKIE = 'connect_me';
const PASSWORD_HASH_KEY = 'password_hash';

export const MIN_PASSWORD_LENGTH = 6;

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function equalConstantTime(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * The shared password's hash. APP_PASSWORD wins when set (the deploy-time way);
 * otherwise it's whatever the pair chose on first run, stored hashed in the DB.
 * Null means nobody has set one yet.
 */
export async function getPasswordHash(): Promise<string | null> {
  const fromEnv = process.env.APP_PASSWORD?.trim();
  if (fromEnv) return sha256Hex(fromEnv);
  return getStore().getMeta(PASSWORD_HASH_KEY);
}

export async function setPassword(password: string): Promise<string> {
  const hash = await sha256Hex(password);
  await getStore().setMeta(PASSWORD_HASH_KEY, hash);
  return hash;
}

/** The session cookie derives from the password hash, never the password. */
export function sessionTokenFor(passwordHash: string): Promise<string> {
  return sha256Hex(`connect:v1:${passwordHash}`);
}

export async function matchesPassword(candidate: string, passwordHash: string): Promise<boolean> {
  return equalConstantTime(await sha256Hex(candidate), passwordHash);
}

export type AuthState = 'needs-setup' | 'unauthenticated' | 'ok';

/**
 * Both people share one password, so this answers "is this browser allowed in",
 * not "who is this". Identity is a separate, non-security preference (ME_COOKIE).
 */
export async function authState(): Promise<AuthState> {
  const hash = await getPasswordHash();
  if (!hash) return 'needs-setup';

  const cookie = (await cookies()).get(AUTH_COOKIE)?.value;
  if (!cookie) return 'unauthenticated';

  return equalConstantTime(cookie, await sessionTokenFor(hash)) ? 'ok' : 'unauthenticated';
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24 * 30,
} as const;
