/**
 * Comprehensive Date & Timestamp Utilities
 * Resolves locale-dependent month/date swapping (e.g. DD/MM/YYYY vs MM/DD/YYYY)
 * and guarantees unambiguous, human-friendly date rendering across citizen and officer portals.
 */

/**
 * Safely parses any date input (ISO 8601, Date object, Unix timestamp, or DD/MM/YYYY string)
 * into a valid Date object without inverting day and month.
 */
export function parseSafeDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }
  if (typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed || trimmed === 'Pending' || trimmed === 'Just now') {
      return null;
    }

    // 1. ISO-8601 format: YYYY-MM-DD... (Always unambiguous)
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) return d;
    }

    // 2. Localized string format: DD/MM/YYYY or DD-MM-YYYY (with optional time)
    // Common in Indian and British locales (e.g., "06/10/2026, 11:32:30 am" or "6/10/2026")
    const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:[,\s]+(.*))?$/);
    if (dmyMatch) {
      const p1 = parseInt(dmyMatch[1], 10);
      const p2 = parseInt(dmyMatch[2], 10);
      const year = parseInt(dmyMatch[3], 10);
      const timePart = dmyMatch[4];

      // In Indian municipal applications, dates are DD/MM/YYYY
      // If p1 > 12, p1 must be day.
      // If p2 > 12, p2 must be day (MM/DD/YYYY).
      let day = p1;
      let month = p2 - 1; // 0-indexed

      if (p1 <= 12 && p2 > 12) {
        day = p2;
        month = p1 - 1;
      }

      let hours = 0;
      let minutes = 0;
      let seconds = 0;

      if (timePart) {
        const timeMatch = timePart.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i);
        if (timeMatch) {
          hours = parseInt(timeMatch[1], 10);
          minutes = parseInt(timeMatch[2], 10);
          seconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
          const ampm = timeMatch[4] ? timeMatch[4].toLowerCase() : null;
          if (ampm === 'pm' && hours < 12) hours += 12;
          if (ampm === 'am' && hours === 12) hours = 0;
        }
      }

      const parsed = new Date(year, month, day, hours, minutes, seconds);
      if (!isNaN(parsed.getTime())) return parsed;
    }

    // 3. Fallback standard Date parsing
    const fallback = new Date(trimmed);
    if (!isNaN(fallback.getTime())) return fallback;
  }

  return null;
}

/**
 * Formats a date into "Oct 6, 2026" (Month name spelled out to prevent day/month confusion).
 */
export function formatDate(val: any, fallback = 'Recently'): string {
  const d = parseSafeDate(val);
  if (!d) return fallback;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Formats a date into "Oct 6, 2026 at 11:32 AM".
 */
export function formatDateTime(val: any, fallback = 'Recently'): string {
  const d = parseSafeDate(val);
  if (!d) return fallback;
  const datePart = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timePart = d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return `${datePart} at ${timePart}`;
}

/**
 * Formats a timeline event timestamp into "Oct 6, 2026 • 11:32 AM" or returns raw status string (e.g. "Pending").
 */
export function formatTimelineTimestamp(val: any, fallback = 'Pending'): string {
  if (!val || val === 'Pending') return 'Pending';
  if (val === 'Just now') return 'Just now';
  if (val === 'Assigned') return 'Assigned';
  if (val === 'In Progress') return 'In Progress';
  if (val === 'Resolved') return 'Resolved';
  if (val === 'Completed') return 'Completed';

  const d = parseSafeDate(val);
  if (!d) return typeof val === 'string' ? val : fallback;

  const datePart = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timePart = d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return `${datePart} • ${timePart}`;
}

/**
 * Formats a short timestamp into "Oct 6, 11:32 AM" for compact cards and tables.
 */
export function formatCompactDateTime(val: any, fallback = 'Pending'): string {
  if (!val || val === 'Pending') return 'Pending';
  const d = parseSafeDate(val);
  if (!d) return typeof val === 'string' ? val : fallback;

  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Converts any date representation to a canonical ISO-8601 string.
 */
export function toCanonicalIso(val: any): string {
  const d = parseSafeDate(val);
  return d ? d.toISOString() : new Date().toISOString();
}
