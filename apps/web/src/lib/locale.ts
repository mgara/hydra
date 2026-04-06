// Detect the user's browser locale and provide consistent date/time formatting.
// Uses the browser's Intl API — respects system language, date order, and 12/24h clock.

/** The user's primary locale (e.g. "en-US", "fr-CA", "de-DE") */
export const USER_LOCALE = navigator.language || 'en-US';

/** Whether the user's locale uses 12-hour time */
export const IS_12H = new Intl.DateTimeFormat(USER_LOCALE, { hour: 'numeric' })
  .resolvedOptions().hour12 ?? false;

// ── Shared formatters (created once, reused) ─────────────

const timeFormatter = new Intl.DateTimeFormat(USER_LOCALE, {
  hour: '2-digit',
  minute: '2-digit',
});

const time24Formatter = new Intl.DateTimeFormat(USER_LOCALE, {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const shortDateFormatter = new Intl.DateTimeFormat(USER_LOCALE, {
  month: 'short',
  day: 'numeric',
});

const fullDateFormatter = new Intl.DateTimeFormat(USER_LOCALE, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat(USER_LOCALE, {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const weekdayShortFormatter = new Intl.DateTimeFormat(USER_LOCALE, {
  weekday: 'short',
});

const datePureFormatter = new Intl.DateTimeFormat(USER_LOCALE, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

// ── Public API ───────────────────────────────────────────

/** Format time: "2:30 PM" or "14:30" depending on locale */
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return timeFormatter.format(d);
}

/** Format time always in 24h: "14:30" */
export function formatTime24(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return time24Formatter.format(d);
}

/** Format short date: "Apr 5" or "5 avr." depending on locale */
export function formatShortDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return shortDateFormatter.format(d);
}

/** Format full date: "Sat, Apr 5, 2026" or locale equivalent */
export function formatFullDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return fullDateFormatter.format(d);
}

/** Format date + time: "Apr 5, 2:30 PM" or locale equivalent */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return dateTimeFormatter.format(d);
}

/** Format date only: "Apr 5, 2026" or locale equivalent */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return datePureFormatter.format(d);
}

/** Short weekday name: "Mon", "Sat", etc. */
export function formatWeekday(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return weekdayShortFormatter.format(d);
}
