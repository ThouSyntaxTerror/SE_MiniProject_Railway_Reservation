// SRS §2.4: times are displayed with an explicit timezone label.
import { describe, expect, test } from 'vitest';
import { formatDateTime, timeZoneLabel } from '../time.js';

describe('time helpers', () => {
  test('timeZoneLabel names the viewer\'s zone the same way the browser formats it', () => {
    const expected = new Intl.DateTimeFormat([], { timeZoneName: 'short' })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName').value;

    expect(timeZoneLabel()).toBe(expected);
    expect(timeZoneLabel().length).toBeGreaterThan(0);
  });

  test('formatDateTime always ends with the zone label', () => {
    const iso = '2026-12-01T03:30:00.000Z';
    const label = timeZoneLabel(new Date(iso));

    const text = formatDateTime(iso);

    expect(text.endsWith(label)).toBe(true);
    expect(text).toMatch(/2026/);
    expect(text).toMatch(/\d{2}:\d{2}/);
  });
});
