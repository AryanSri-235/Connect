/**
 * The dashboard's time-range options.
 *
 * Kept in its own module with no server imports: the toolbar is a client
 * component, and pulling these from `sync.ts` would drag the Postgres driver
 * into the browser bundle.
 */

export const WINDOW_OPTIONS = [91, 182, 365] as const;

export type WindowDays = (typeof WINDOW_OPTIONS)[number];

export const DEFAULT_WINDOW: WindowDays = 182;

export const WINDOW_LABEL: Record<WindowDays, string> = {
  91: '3 months',
  182: '6 months',
  365: '1 year',
};

export function normalizeWindow(value: string | number | undefined): WindowDays {
  const n = Number(value);
  return (WINDOW_OPTIONS as readonly number[]).includes(n) ? (n as WindowDays) : DEFAULT_WINDOW;
}
