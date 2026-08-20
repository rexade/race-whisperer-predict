// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { sortByPrediction, winnerMargin, legConfidence, spreadSuggestion, valuePickKeys } from '../raceRanking';
import { horseResultKey } from '../horseResultIdentity';
import type { V75HorseResult } from '../../types/raceResultTypes';
import { RaceScoreCalculator } from '../../services/raceScoreCalculator';

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

  it('uses the same uncertainty-aware order for display and persisted horse ranks', () => {
    const uncertainLeader = { ...mk(1, 71), uncertain: true };
    const reliableRunner = mk(2, 71.1);

    const displayed = sortByPrediction([uncertainLeader, reliableRunner]);
    const scored = RaceScoreCalculator.calculateScoresAndRanks([uncertainLeader, reliableRunner]);

    expect(displayed.map(h => h.horseId)).toEqual([2, 1]);
    expect(scored.map(h => [h.horseId, h.rank])).toEqual([[2, 1], [1, 2]]);
    expect(winnerMargin(displayed)).toBeCloseTo(0.1, 5);
  });

  it('uses start number before horse identity to break otherwise exact ties', () => {
    const laterStarter = { ...mk(1, 71), startNumber: 8, postPosition: 1 };
    const earlierStarter = { ...mk(10, 71), startNumber: 3, postPosition: 1 };

    expect(sortByPrediction([laterStarter, earlierStarter])).toEqual([earlierStarter, laterStarter]);
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

describe('valuePickKeys', () => {
  it('flags a top-4 model pick the market ranks 3+ lower', () => {
    // Horse 4: model rank 1, market rank 4 → value
    const sorted = sortByPrediction([mk(1, 72.0, 30), mk(2, 72.5, 20), mk(3, 73.0, 10), mk(4, 71.0, 5)]);
    const value = valuePickKeys(sorted);
    expect(value.has(horseResultKey(sorted[0]))).toBe(true);
    expect(value.has(horseResultKey(sorted[1]))).toBe(false);
  });

  it('returns empty when market data is missing', () => {
    const sorted = sortByPrediction([mk(1, 72.0), mk(2, 72.5), mk(3, 73.0), mk(4, 71.0)]);
    expect(valuePickKeys(sorted).size).toBe(0);
  });

  it('keeps value-pick identity distinct when every horseId is zero', () => {
    const horses = [
      { ...mk(0, 72, 30), horseKey: 'r1:start:1', startNumber: 1, postPosition: 1 },
      { ...mk(0, 72.5, 20), horseKey: 'r1:start:2', startNumber: 2, postPosition: 2 },
      { ...mk(0, 73, 10), horseKey: 'r1:start:3', startNumber: 3, postPosition: 3 },
      { ...mk(0, 71, 5), horseKey: 'r1:start:4', startNumber: 4, postPosition: 4 },
    ];
    const sorted = sortByPrediction(horses);

    expect([...valuePickKeys(sorted)]).toEqual(['r1:start:4']);
  });
});
