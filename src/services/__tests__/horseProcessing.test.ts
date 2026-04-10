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
