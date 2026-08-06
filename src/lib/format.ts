/**
 * Number formatting pinned to one locale.
 *
 * Bare `toLocaleString()` resolves differently on the server (Node's ICU) than
 * in the browser, which both breaks hydration in client components and makes
 * the same figure render two ways across the page. Pinning the locale keeps
 * grouping identical everywhere.
 */
const GROUPED = new Intl.NumberFormat('en-US');

export function num(value: number): string {
  return GROUPED.format(value);
}
