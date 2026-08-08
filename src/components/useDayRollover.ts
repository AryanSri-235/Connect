'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Re-renders the dashboard when the calendar day changes underneath it.
 *
 * The page is server-rendered, so "today" is fixed at render time. A tab left
 * open overnight would keep showing yesterday — wrong date in the heading, and
 * yesterday's goals presented as today's. Polling is cheap (a date comparison)
 * and the focus/visibility hooks cover the common case of a laptop that slept
 * through midnight and woke on the other side of it.
 */
export function useDayRollover(currentDay: string, timezone: string): void {
  const router = useRouter();

  useEffect(() => {
    let format: (date: Date) => string;
    try {
      const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      format = (d) => fmt.format(d);
    } catch {
      // An unusable APP_TIMEZONE is the server's problem to report; don't let it
      // break the page here.
      return;
    }

    let refreshed = false;
    const check = () => {
      if (refreshed) return;
      if (format(new Date()) !== currentDay) {
        refreshed = true; // one refresh per rollover, not one per tick
        router.refresh();
      }
    };

    const timer = window.setInterval(check, 30_000);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    check();

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, [currentDay, timezone, router]);
}
