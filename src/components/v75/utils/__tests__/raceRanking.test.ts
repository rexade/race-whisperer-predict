// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { sortByPrediction, winnerMargin, legConfidence, spreadSuggestion, valuePickIds } from '../raceRanking';
import type { V75HorseResult } from '../../types/raceResultTypes';

const mk = (id: number, seconds: number, betDistribution?: number): V75HorseResult => ({
  raceNumber: 1,
  raceId: 'r1',
  horseId: id,
  horseName: `Horse ${id}`,
  postPosition: id,
  driverName: 'D',
  track: 'T',
  distance: 2140,
  startMethod: 'auto',
  statistics: { startPoints: 0, placePercentage: 0, winPercentage: 0, earningsPerStart: 0 },
  betDistribution,
  modernNormalizedResult: {
    rawTime: { minutes: 1, seconds: 10, tenths: 0 },
    modernNormalizedTime: {
      minutes: Math.floor(seconds / 60),
      seconds: Math.floor(seconds % 60),
      tenths: Math.round((seconds % 1) * 10),
    },
    adjustments: {} as any,
  } as any,
} as V75HorseResult);

describe('sortByPrediction / winnerMargin', () => {
  it('sorts fastest first and computes the rank1→2 margin', () => {
    const sorted = sortByPrediction([mk(1, 72.0), mk(2, 71.0), mk(3, 73.5)]);
    expect(sorted.map(h => h.horseId)).toEqual([2, 1, 3]);
    expect(winnerMargin(sorted)).toBeCloseTo(1.0, 5);
  });

  it('returns undefined margin for a single horse', () => {
    expect(winnerMargin(sortByPrediction([mk(1, 72)]))).toBeUndefined();
  });
});

describe('legConfidence', () => {
  it('maps margins to spik / favorit / oppet', () => {
    expect(legConfidence(1.0)).toBe('spik');
    expect(legConfidence(0.5)).toBe('favorit');
    expect(legConfidence(0.1)).toBe('oppet');
    expect(legConfidence(undefined)).toBe('oppet');
  });
});

describe('spreadSuggestion', () => {
  it('suggests a single horse for a spik leg', () => {
    const sorted = sortByPrediction([mk(1, 71.0), mk(2, 72.0), mk(3, 72.1)]);
    const s = spreadSuggestion(sorted);
    expect(s.type).toBe('spik');
    expect(s.horses.map(h => h.horseId)).toEqual([1]);
  });

  it('covers all horses within 0.6s on an open leg, min 3', () => {
    const sorted = sortByPrediction([mk(1, 71.0), mk(2, 71.1), mk(3, 71.4), mk(4, 71.5), mk(5, 73.0)]);
    const s = spreadSuggestion(sorted);
    expect(s.type).toBe('oppet');
    expect(s.horses.map(h => h.horseId)).toEqual([1, 2, 3, 4]);
  });

  it('caps coverage at 5 horses', () => {
    const sorted = sortByPrediction(Array.from({ length: 8 }, (_, i) => mk(i + 1, 71 + i * 0.05)));
    expect(spreadSuggestion(sorted).horses.length).toBeLessThanOrEqual(5);
  });
});

describe('valuePickIds', () => {
  it('flags a top-4 model pick the market ranks 3+ lower', () => {
    // Horse 4: model rank 1, market rank 4 → value
    const sorted = sortByPrediction([mk(1, 72.0, 30), mk(2, 72.5, 20), mk(3, 73.0, 10), mk(4, 71.0, 5)]);
    const value = valuePickIds(sorted);
    expect(value.has(4)).toBe(true);
    expect(value.has(1)).toBe(false);
  });

  it('returns empty when market data is missing', () => {
    const sorted = sortByPrediction([mk(1, 72.0), mk(2, 72.5), mk(3, 73.0), mk(4, 71.0)]);
    expect(valuePickIds(sorted).size).toBe(0);
  });
});
