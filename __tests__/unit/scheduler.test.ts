import { describe, it, expect } from 'vitest';
import { calculateSendTimes } from '@/lib/mailer/scheduler';

// Helper: create a UTC date at a given IST time (IST = UTC+5:30)
function istDate(dateStr: string, hour: number, minute = 0): Date {
  return new Date(`${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+05:30`);
}

describe('calculateSendTimes', () => {
  it('returns correct number of send times', () => {
    const start = istDate('2026-06-20', 9);
    const times = calculateSendTimes(5, start, 2, 0, '09:00', null);
    expect(times).toHaveLength(5);
  });

  it('returns Date objects', () => {
    const start = istDate('2026-06-20', 9);
    const times = calculateSendTimes(3, start, 2, 0, '09:00', null);
    times.forEach(t => expect(t).toBeInstanceOf(Date));
  });

  it('stagger times apart by roughly the gap', () => {
    const start = istDate('2026-06-20', 9);
    const gapMinutes = 10;
    const times = calculateSendTimes(3, start, gapMinutes, 0, '09:00', null); // 0 jitter
    const gapMs = gapMinutes * 60 * 1000;
    const diff1 = times[1].getTime() - times[0].getTime();
    const diff2 = times[2].getTime() - times[1].getTime();
    // With 0% jitter, gaps should be exactly gapMs
    expect(diff1).toBe(gapMs);
    expect(diff2).toBe(gapMs);
  });

  it('clamps early morning times to send_time start (business hours)', () => {
    // Start at 2 AM IST — should be pushed forward to 09:00 IST
    const earlyStart = istDate('2026-06-20', 2);
    const times = calculateSendTimes(1, earlyStart, 2, 0, '09:00', null);
    const istHour = new Date(times[0].getTime() + 5.5 * 60 * 60 * 1000).getUTCHours();
    expect(istHour).toBe(9);
  });

  it('pushes after-hours times to next day at send_time', () => {
    // Start at 21:00 IST — after 19:00 cutoff, should move to next day 09:00
    const lateStart = istDate('2026-06-20', 21);
    const times = calculateSendTimes(1, lateStart, 2, 0, '09:00', null);
    // Next day date should be 2026-06-21 in IST
    const istDate_result = new Date(times[0].getTime() + 5.5 * 60 * 60 * 1000);
    expect(istDate_result.getUTCDate()).toBe(21);
    expect(istDate_result.getUTCHours()).toBe(9);
  });

  it('caps send times at endDate when provided', () => {
    const start = istDate('2026-06-20', 9);
    const endAt = istDate('2026-06-20', 9, 5); // Only 5 minutes window
    // With a 10-min gap, the 2nd recipient would exceed end date → capped
    const times = calculateSendTimes(3, start, 10, 0, '09:00', endAt);
    times.forEach(t => expect(t.getTime()).toBeLessThanOrEqual(endAt.getTime()));
  });

  it('handles single recipient correctly', () => {
    const start = istDate('2026-06-20', 10, 30);
    const times = calculateSendTimes(1, start, 5, 0, '10:30', null);
    expect(times).toHaveLength(1);
    const istHour = new Date(times[0].getTime() + 5.5 * 60 * 60 * 1000).getUTCHours();
    expect(istHour).toBe(10);
  });

  it('throws on invalid start date', () => {
    const invalid = new Date('not-a-date');
    expect(() => calculateSendTimes(1, invalid, 2, 0, '09:00', null)).toThrow('Invalid start date');
  });

  it('jitter keeps times within expected range of exact gap', () => {
    const start = istDate('2026-06-20', 10);
    const gapMinutes = 10;
    const jitterPct = 20; // ±20%
    const times = calculateSendTimes(5, start, gapMinutes, jitterPct, '10:00', null);

    const gapMs = gapMinutes * 60 * 1000;
    const tolerance = gapMs * (jitterPct / 100);

    for (let i = 1; i < times.length; i++) {
      const diff = times[i].getTime() - times[i - 1].getTime();
      // diff should be within gapMs ± tolerance
      expect(diff).toBeGreaterThanOrEqual(gapMs - tolerance);
      expect(diff).toBeLessThanOrEqual(gapMs + tolerance);
    }
  });
});
