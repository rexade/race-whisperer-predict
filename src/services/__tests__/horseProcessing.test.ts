import { describe, it, expect } from 'vitest';
import { processHorseKmTimes, ATGHistoricalRace } from '../horseProcessing';

const baseRace = (overrides: Partial<ATGHistoricalRace> = {}): ATGHistoricalRace => ({
  raceId: 'r1',
  date: '2026-01-01',
  distance: 2140,
  startMethod: 'auto',
  track: 'Solvalla',
  kmTime: { minutes: 1, seconds: 14, tenths: 2 },
  finishOrder: 3,
  postPosition: 4,
  galloped: false,
  disqualified: false,
  ...overrides,
});

describe('processHorseKmTimes — gallopCount and disqualificationCount', () => {
  it('gallopCount is 0 when no races galloped', async () => {
    const races = [
      baseRace({ date: '2026-01-10', raceId: 'r1' }),
      baseRace({ date: '2026-01-05', raceId: 'r2' }),
    ];
    const result = await processHorseKmTimes(1, 'TestHorse', races);
    expect(result.gallopCount).toBe(0);
    expect(result.disqualificationCount).toBe(0);
  });

  it('gallopCount counts galloped races in last 10 starts', async () => {
    const races = [
      baseRace({ date: '2026-01-10', raceId: 'r1', galloped: true }),
      baseRace({ date: '2026-01-05', raceId: 'r2', galloped: true }),
      baseRace({ date: '2025-12-20', raceId: 'r3' }),
    ];
    const result = await processHorseKmTimes(2, 'GallopHorse', races);
    expect(result.gallopCount).toBe(2);
  });

  it('disqualificationCount counts DQ races in last 10 starts', async () => {
    const races = [
      baseRace({ date: '2026-01-10', raceId: 'r1', disqualified: true }),
      baseRace({ date: '2026-01-05', raceId: 'r2' }),
    ];
    const result = await processHorseKmTimes(3, 'DQHorse', races);
    expect(result.disqualificationCount).toBe(1);
  });

  it('only counts within last 10 starts by date order', async () => {
    // 12 races — oldest 2 are galloped, should be outside the window
    const races = Array.from({ length: 12 }, (_, i) => {
      const dayOffset = 12 - i; // most recent first when sorted desc
      const dateStr = `2026-01-${String(dayOffset).padStart(2, '0')}`;
      return baseRace({
        raceId: `r${i}`,
        date: dateStr,
        galloped: i >= 10, // positions 10 and 11 (oldest) are galloped
      });
    });
    const result = await processHorseKmTimes(4, 'WindowHorse', races);
    // Sorted desc: 2026-01-12 … 2026-01-03 (indices 0-9 in sorted order are clean)
    // The 2 galloped ones (i=10,11) have dates 2026-01-02 and 2026-01-01 → outside top-10
    expect(result.gallopCount).toBe(0);
  });

  it('gallopCount fires gallopRisk threshold when >= 2 in last 10', async () => {
    const races = [
      baseRace({ date: '2026-01-10', raceId: 'r1', galloped: true }),
      baseRace({ date: '2026-01-08', raceId: 'r2', galloped: true }),
      baseRace({ date: '2026-01-05', raceId: 'r3' }),
    ];
    const result = await processHorseKmTimes(5, 'RiskyHorse', races);
    expect(result.gallopCount).toBeGreaterThanOrEqual(2);
  });
});

describe('processHorseKmTimes — top-3 time averaging (H2)', () => {
  it('bestTime equals single record when only 1 valid time', async () => {
    const races = [
      baseRace({ date: '2026-01-10', raceId: 'r1', kmTime: { minutes: 1, seconds: 14, tenths: 0 } }),
    ];
    const result = await processHorseKmTimes(10, 'SingleHorse', races);
    // 1:14.0 — single record, no averaging
    expect(result.bestTime.minutes).toBe(1);
    expect(result.bestTime.seconds).toBe(14);
    expect(result.bestTime.tenths).toBe(0);
  });

  it('bestTime is average of top-2 when only 2 valid times available', async () => {
    // Two races at same distance/method so normalization is identity
    const races = [
      baseRace({ date: '2026-01-10', raceId: 'r1', kmTime: { minutes: 1, seconds: 14, tenths: 0 } }), // 74.0s
      baseRace({ date: '2026-01-05', raceId: 'r2', kmTime: { minutes: 1, seconds: 16, tenths: 0 } }), // 76.0s
    ];
    const result = await processHorseKmTimes(11, 'AvgHorse', races);
    // Average = (74.0 + 76.0) / 2 = 75.0s = 1:15.0
    const totalTenths = result.bestTime.minutes * 600 + result.bestTime.seconds * 10 + result.bestTime.tenths;
    expect(totalTenths).toBe(750); // 75.0s in tenths
  });

  it('bestRecordTime always holds the fastest individual record', async () => {
    const races = [
      baseRace({ date: '2026-01-10', raceId: 'r1', kmTime: { minutes: 1, seconds: 14, tenths: 0 } }),
      baseRace({ date: '2026-01-05', raceId: 'r2', kmTime: { minutes: 1, seconds: 16, tenths: 0 } }),
    ];
    const result = await processHorseKmTimes(12, 'RecordHorse', races);
    // bestRecordTime must be the actual fastest (74.0s), not the average
    const recordTenths = result.bestRecordTime.minutes * 600 + result.bestRecordTime.seconds * 10 + result.bestRecordTime.tenths;
    expect(recordTenths).toBe(740); // 1:14.0 = 74.0s
  });

  it('bestTime with 3 records uses average of top-3', async () => {
    const races = [
      baseRace({ date: '2026-01-10', raceId: 'r1', kmTime: { minutes: 1, seconds: 14, tenths: 0 } }), // 74.0s
      baseRace({ date: '2026-01-05', raceId: 'r2', kmTime: { minutes: 1, seconds: 16, tenths: 0 } }), // 76.0s
      baseRace({ date: '2025-12-20', raceId: 'r3', kmTime: { minutes: 1, seconds: 18, tenths: 0 } }), // 78.0s
    ];
    const result = await processHorseKmTimes(13, 'ThreeHorse', races);
    // Avg of top-3: (74.0 + 76.0 + 78.0) / 3 = 76.0s = 1:16.0
    const totalTenths = result.bestTime.minutes * 600 + result.bestTime.seconds * 10 + result.bestTime.tenths;
    expect(totalTenths).toBe(760);
  });

  it('bestTime with 4+ records still averages only the fastest 3', async () => {
    const races = [
      baseRace({ date: '2026-01-10', raceId: 'r1', kmTime: { minutes: 1, seconds: 14, tenths: 0 } }), // 74.0s
      baseRace({ date: '2026-01-05', raceId: 'r2', kmTime: { minutes: 1, seconds: 16, tenths: 0 } }), // 76.0s
      baseRace({ date: '2025-12-20', raceId: 'r3', kmTime: { minutes: 1, seconds: 18, tenths: 0 } }), // 78.0s
      baseRace({ date: '2025-12-01', raceId: 'r4', kmTime: { minutes: 1, seconds: 25, tenths: 0 } }), // 85.0s — slow outlier, ignored
    ];
    const result = await processHorseKmTimes(14, 'FourHorse', races);
    // Avg of top-3 only: (74.0 + 76.0 + 78.0) / 3 = 76.0s
    const totalTenths = result.bestTime.minutes * 600 + result.bestTime.seconds * 10 + result.bestTime.tenths;
    expect(totalTenths).toBe(760);
  });
});

describe('processHorseKmTimes — gallopDates', () => {
  it('gallopDates contains the date of a galloped race in last 10 starts', async () => {
    const races = [
      baseRace({ date: '2026-01-10', raceId: 'r1', galloped: true }),
      baseRace({ date: '2026-01-05', raceId: 'r2' }),
    ];
    const result = await processHorseKmTimes(6, 'GallopDateHorse', races);
    expect(result.gallopDates).toContain('2026-01-10');
    expect(result.gallopDates).toHaveLength(1);
  });

  it('gallopDates is empty when no races galloped', async () => {
    const races = [
      baseRace({ date: '2026-01-10', raceId: 'r1' }),
      baseRace({ date: '2026-01-05', raceId: 'r2' }),
    ];
    const result = await processHorseKmTimes(7, 'CleanHorse', races);
    expect(result.gallopDates).toHaveLength(0);
  });
});
