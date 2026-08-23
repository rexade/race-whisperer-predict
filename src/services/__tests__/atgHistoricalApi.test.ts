// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { processHistoricalRecords, type ATGHistoricalRecord } from '../atgHistoricalApi';

const record = (
  id: string,
  date: string,
  odds: number,
  extra: Partial<ATGHistoricalRecord> = {}
): ATGHistoricalRecord => ({
  date,
  odds,
  kmTime: { minutes: 1, seconds: 15, tenths: 0 },
  place: '1',
  race: { id, startMethod: 'auto' },
  track: { name: 'Solvalla' },
  start: { distance: 2140, postPosition: 1 },
  ...extra,
});

describe('processHistoricalRecords temporal cutoff', () => {
  it('does not expose post-cutoff times as invalid-time fallback candidates', () => {
    const result = processHistoricalRecords(
      [record('future', '2026-05-02', 10)],
      'Future Horse',
      '2026-05-01'
    );

    expect(result.records).toEqual([]);
    expect(result.invalidCandidates).toEqual([]);
  });

  it('does not admit an undated detail record through the all-prior fallback', () => {
    const result = processHistoricalRecords(
      [record('undated', '', 10)],
      'Undated Horse',
      '2026-05-01'
    );

    expect(result.records).toEqual([]);
    expect(result.invalidCandidates).toEqual([]);
  });

  it('does not admit a same-year aggregate whose synthetic date is after the cutoff', () => {
    const aggregate = {
      ...record('year-stats', '2026-12-31', 10),
      meta: { source: 'statistics-years', startMethod: 'auto', distance: 'medium' },
    } as any;

    const result = processHistoricalRecords([aggregate], 'Aggregate Horse', '2026-05-01');

    expect(result.records).toEqual([]);
    expect(result.invalidCandidates).toEqual([]);
  });

  it('derives odds and gallop metadata only from starts before the cutoff', () => {
    const result = processHistoricalRecords([
      record('past', '2026-04-20', 2),
      record('same-day', '2026-05-01', 50, { galloped: true }),
      record('future', '2026-05-05', 100, { galloped: true }),
    ], 'Odds Horse', '2026-05-01');

    expect(result.records.map(r => r.race.id)).toEqual(['past']);
    expect(result.metadata.averageHistoricalOdds).toBe(2);
    expect(result.metadata.lastOdds).toBe(2);
    expect(result.metadata.gallopDates).toEqual([]);
  });
});

// Aggregate/statistics records are snapshots taken at fetch time and carry synthetic
// dates (current year -> `{year}-12-31`, life -> undated). Whether they may be used
// depends entirely on which direction the cutoff points.
const aggregate = (date: string | undefined): ATGHistoricalRecord => ({
  date,
  kmTime: { minutes: 1, seconds: 14, tenths: 5 },
  place: '3',
  race: { id: 'stat_M_2026', startMethod: 'auto' },
  track: { name: 'Unknown' },
  meta: { source: 'statistics', distance: 'medium', startMethod: 'auto' },
} as unknown as ATGHistoricalRecord);

describe('processHistoricalRecords aggregate handling by cutoff mode', () => {
  const year = new Date().getFullYear();
  const raceDate = `${year}-08-21`;

  it('keeps a current-year aggregate when predicting an upcoming race', () => {
    const result = processHistoricalRecords([aggregate(`${year}-12-31`)], 'H', raceDate, 'live');
    expect(result.records).toHaveLength(1);
  });

  it('keeps an undated life aggregate when predicting an upcoming race', () => {
    const result = processHistoricalRecords([aggregate(undefined)], 'H', raceDate, 'live');
    expect(result.records).toHaveLength(1);
  });

  it('drops a current-year aggregate when replaying a past race', () => {
    const result = processHistoricalRecords([aggregate(`${year}-12-31`)], 'H', raceDate, 'historical');
    expect(result.records).toEqual([]);
    expect(result.invalidCandidates).toEqual([]);
  });

  it('drops an undated life aggregate when replaying a past race', () => {
    const result = processHistoricalRecords([aggregate(undefined)], 'H', raceDate, 'historical');
    expect(result.records).toEqual([]);
    expect(result.invalidCandidates).toEqual([]);
  });

  it('defaults to the leakage-safe mode when no mode is given', () => {
    const result = processHistoricalRecords([aggregate(`${year}-12-31`)], 'H', raceDate);
    expect(result.records).toEqual([]);
  });

  it('still rejects a genuinely post-cutoff dated record in live mode', () => {
    const result = processHistoricalRecords(
      [record('after', `${year}-08-22`, 10)],
      'H',
      raceDate,
      'live'
    );
    expect(result.records).toEqual([]);
  });
});
