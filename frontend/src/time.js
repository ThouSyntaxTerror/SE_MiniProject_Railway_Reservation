// SRS §2.4: timestamps are stored in UTC and displayed with an explicit timezone label. The API
// sends UTC (ISO 8601 with "Z"); the browser converts to the viewer's zone, and these helpers make
// that zone visible instead of leaving the reader to guess.

// Short name of the viewer's time zone, e.g. "IST" or "GMT+5:30" (depends on the browser's locale).
export function timeZoneLabel(date = new Date()) {
  const part = new Intl.DateTimeFormat([], { timeZoneName: 'short' })
    .formatToParts(date)
    .find((p) => p.type === 'timeZoneName');
  return part ? part.value : 'local time';
}

// A full date and time with its zone, e.g. "1 Dec 2026, 09:00 GMT+5:30".
export function formatDateTime(iso) {
  return new Date(iso).toLocaleString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  });
}
