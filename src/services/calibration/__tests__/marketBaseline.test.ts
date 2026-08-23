// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { marketRankByKey } from '../historicalCalibrationService';
import type { V75RaceData } from '@/services/v75CalendarApi';

const race = (horses: Array<{ horseKey: string; odds?: number; betDistribution?: number }>) =>
  ({ horses }) as unknown as V75RaceData;

describe('marketRankByKey', () => {
  it('treats the shortest odds as the favourite', () => {
    const ranks = marketRankByKey(
      race([
        { horseKey: 'a', odds: 8.5 },
        { horseKey: 'b', odds: 2.1 },
        { horseKey: 'c', odds: 4.0 },
      ]),
      ['a', 'b', 'c']
    );
    expect(ranks!.get('b')).toBe(1);
    expect(ranks!.get('c')).toBe(2);
    expect(ranks!.get('a')).toBe(3);
  });

  it('falls back to bet distribution, where higher is more favoured', () => {
    const ranks = marketRankByKey(
      race([
        { horseKey: 'a', betDistribution: 0.10 },
        { horseKey: 'b', betDistribution: 0.42 },
      ]),
      ['a', 'b']
    );
    expect(ranks!.get('b')).toBe(1);
  });

  it('never mixes odds and bet distribution within one race', () => {
    // 'a' has odds only, 'b' has spelprocent only. Ranking across the two scales
    // would be meaningless, so the race is excluded rather than half-ranked.
    const ranks = marketRankByKey(
      race([
        { horseKey: 'a', odds: 2.0 },
        { horseKey: 'b', betDistribution: 0.5 },
      ]),
      ['a', 'b']
    );
    expect(ranks).toBeNull();
  });

  it('excludes a race when any evaluated horse lacks market data', () => {
    // The horse without data could be the actual favourite, which would make
    // "market rank 1" a claim about a different horse than it appears to be.
    const ranks = marketRankByKey(
      race([
        { horseKey: 'a', odds: 2.0 },
        { horseKey: 'b', odds: 3.0 },
        { horseKey: 'c' },
      ]),
      ['a', 'b', 'c']
    );
    expect(ranks).toBeNull();
  });

  it('ignores non-positive and non-finite odds rather than ranking them first', () => {
    expect(marketRankByKey(race([
      { horseKey: 'a', odds: 0 }, { horseKey: 'b', odds: 3 },
    ]), ['a', 'b'])).toBeNull();
    expect(marketRankByKey(race([
      { horseKey: 'a', odds: Number.NaN }, { horseKey: 'b', odds: 3 },
    ]), ['a', 'b'])).toBeNull();
  });

  it('declines to rank a single-horse field', () => {
    expect(marketRankByKey(race([{ horseKey: 'a', odds: 2 }]), ['a'])).toBeNull();
  });
});
