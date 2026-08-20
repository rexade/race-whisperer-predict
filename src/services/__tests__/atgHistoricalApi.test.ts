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
