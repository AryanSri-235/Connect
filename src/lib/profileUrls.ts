/**
 * Accepts what people actually paste — a full profile URL — as well as a bare
 * username, and returns the username the provider APIs need.
 *
 * Returns null when the input can't be read as a profile for that service, so
 * callers can tell "empty" (fine) from "wrong" (worth an error message).
 */

const GITHUB_URL = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/?#\s]+)/i;
// leetcode.com/u/name (current) and leetcode.com/name (legacy) both appear in the wild.
const LEETCODE_URL = /^(?:https?:\/\/)?(?:www\.)?leetcode\.(?:com|cn)\/(?:u\/)?([^/?#\s]+)/i;

const GITHUB_NAME = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
const LEETCODE_NAME = /^[A-Za-z0-9_.-]{1,40}$/;

/** Paths on github.com that are site pages, not people. */
const GITHUB_RESERVED = new Set(['settings', 'orgs', 'features', 'about', 'pricing', 'login', 'explore', 'sponsors']);

function clean(input: string): string {
  return input.trim().replace(/^@/, '').replace(/\/+$/, '');
}

export function parseGithubUsername(input: string): string | null {
  const value = clean(input);
  if (!value) return null;

  const match = value.match(GITHUB_URL);
  const candidate = match ? decodeURIComponent(match[1]) : value;

  if (!GITHUB_NAME.test(candidate)) return null;
  if (GITHUB_RESERVED.has(candidate.toLowerCase())) return null;
  return candidate;
}

export function parseLeetcodeUsername(input: string): string | null {
  const value = clean(input);
  if (!value) return null;

  const match = value.match(LEETCODE_URL);
  const candidate = match ? decodeURIComponent(match[1]) : value;

  if (!LEETCODE_NAME.test(candidate)) return null;
  // "leetcode.com/problemset" and friends are not profiles.
  if (match && ['problemset', 'problems', 'contest', 'discuss', 'explore', 'accounts'].includes(candidate.toLowerCase())) {
    return null;
  }
  return candidate;
}

export const githubProfileUrl = (username: string) => `https://github.com/${username}`;
export const leetcodeProfileUrl = (username: string) => `https://leetcode.com/u/${username}/`;
