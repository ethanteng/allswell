/** Date helpers shared by the sidebar, session header, and the edit dialog. */

/**
 * A session date is a calendar date, not an instant.
 *
 * It is stored as UTC midnight, so formatting it in the viewer's local zone
 * renders the previous day for anyone west of UTC — every US timezone included.
 * Reading and writing it in UTC keeps the date the clinician picked the date
 * they see back.
 */
const CALENDAR_DATE_ZONE = 'UTC';

export function formatSessionDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: CALENDAR_DATE_ZONE,
  });
}

/** ISO timestamp to the `YYYY-MM-DD` an `<input type="date">` expects. */
export function toDateInputValue(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  return date.toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` from a date input back to the stored UTC-midnight timestamp. */
export function fromDateInputValue(value: string): string | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** "3d ago" style label for list rows, where precision matters less than scanning. */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return 'just now';

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;

  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
