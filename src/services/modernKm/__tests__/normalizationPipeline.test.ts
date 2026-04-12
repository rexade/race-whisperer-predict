// @vitest-environment node
/**
 * Unit tests for the modernKm normalization pipeline calculators.
 *
 * Covers:
 *  - performanceCalculators: startPoints, placePercentage, winPercentage,
 *    earnings, and form adjustments
 *  - adjustmentCalculators: distance, race distance, track familiarity, volte
 *  - driverCalculators: driver win-rate adjustment
 */
import { describe, it, expect } from 'vitest';

import {
  calculateStartPointsAdjustment,
  calculateStartPointsAdjustmentFieldAware,
  calculatePlacePercentageAdjustment,
  calculateHorseWinPercentageAdjustment,
  calculateEarningsPerStartAdjustment,
  calculateFormAdjustment,
  calculateLayoffAdjustment,
} from '../performanceCalculators';

import {
  calculateDistanceAdjustment,
  calculateRaceDistanceAdjustment,
  calculateTrackFamiliarityAdjustment,
  calculateVolteStartDistancePenalty,
  calculateTripDependencyModifier,
  calculateGallopReliabilityPenalty,
} from '../adjustmentCalculators';

import { calculateDriverAdjustment } from '../driverCalculators';

// ---------------------------------------------------------------------------
// performanceCalculators
// ---------------------------------------------------------------------------

describe('calculateStartPointsAdjustment', () => {
  it('returns 0 for invalid input', () => {
    expect(calculateStartPointsAdjustment(NaN)).toBe(0);
    expect(calculateStartPointsAdjustment(-100)).toBe(0);
    expect(calculateStartPointsAdjustment(0)).toBe(0);
  });

  it('returns 0 at baseline (1200 pts)', () => {
    expect(calculateStartPointsAdjustment(1200)).toBeCloseTo(0, 4);
  });

  it('returns positive (penalty) below baseline', () => {
    // 900 pts → doc example ≈ +0.267 s
    const adj = calculateStartPointsAdjustment(900);
    expect(adj).toBeGreaterThan(0);
    expect(adj).toBeCloseTo(0.267, 2);
  });

  it('returns negative (bonus) above baseline', () => {
    // 2000 pts → doc example ≈ -0.415 s
    const adj = calculateStartPointsAdjustment(2000);
    expect(adj).toBeLessThan(0);
    expect(adj).toBeCloseTo(-0.415, 2);
  });

  it('saturates near maxImpact for very high values', () => {
    // 16000 pts → doc says ≈ -0.600 s (maxImpact = 0.60)
    const adj = calculateStartPointsAdjustment(16_000);
    expect(adj).toBeLessThan(-0.58);
    expect(adj).toBeGreaterThanOrEqual(-0.60);
  });

  it('respects custom opts', () => {
    // custom baseline = 2000 → at 2000 pts adjustment should be ~0
    expect(calculateStartPointsAdjustment(2000, { baseline: 2000 })).toBeCloseTo(0, 4);
  });
});

describe('calculateStartPointsAdjustmentFieldAware', () => {
  it('falls back to absolute calculation when fewer than 3 valid values', () => {
    const abs = calculateStartPointsAdjustment(900);
    // 2 valid values in field → fallback
    expect(calculateStartPointsAdjustmentFieldAware(900, [800, 1200])).toBeCloseTo(abs, 5);
  });

  it('returns ~0 for the median horse in field', () => {
    const field = [1000, 2000, 3000, 4000, 5000];
    // median = 3000
    const adj = calculateStartPointsAdjustmentFieldAware(3000, field);
    expect(adj).toBeCloseTo(0, 4);
  });

  it('returns negative (bonus) for best horse in field', () => {
    const field = [1000, 2000, 3000, 4000, 5000];
    // Horse at 5000 (top of field) → bonus
    const adj = calculateStartPointsAdjustmentFieldAware(5000, field);
    expect(adj).toBeLessThan(0);
  });

  it('returns positive (penalty) for weakest horse in field', () => {
    const field = [1000, 2000, 3000, 4000, 5000];
    // Horse at 1000 (bottom of field) → penalty
    const adj = calculateStartPointsAdjustmentFieldAware(1000, field);
    expect(adj).toBeGreaterThan(0);
  });

  it('bonus and penalty are symmetric around median', () => {
    const field = [1000, 2000, 3000, 4000, 5000];
    const bonus   = calculateStartPointsAdjustmentFieldAware(5000, field);
    const penalty = calculateStartPointsAdjustmentFieldAware(1000, field);
    // field is symmetric around 3000 → equal magnitude, opposite sign
    expect(bonus + penalty).toBeCloseTo(0, 4);
  });
});

describe('calculatePlacePercentageAdjustment', () => {
  it('returns 0 at baseline 50 %  (5000 basis-points)', () => {
    expect(calculatePlacePercentageAdjustment(5000)).toBeCloseTo(0, 5);
  });

  it('returns negative (bonus) above 50 %', () => {
    // 60 % → (50 - 60) * 0.001 = -0.010
    expect(calculatePlacePercentageAdjustment(6000)).toBeCloseTo(-0.01, 5);
  });

  it('returns positive (penalty) below 50 %', () => {
    // 30 % → (50 - 30) * 0.001 = +0.020
    expect(calculatePlacePercentageAdjustment(3000)).toBeCloseTo(0.02, 5);
  });
});

describe('calculateHorseWinPercentageAdjustment', () => {
  it('returns 0 at baseline 15 %  (1500 basis-points)', () => {
    expect(calculateHorseWinPercentageAdjustment(1500)).toBeCloseTo(0, 5);
  });

  it('returns negative (bonus) above 15 %', () => {
    // 20 % → (15 - 20) * 0.015 = -0.075
    expect(calculateHorseWinPercentageAdjustment(2000)).toBeCloseTo(-0.075, 5);
  });

  it('returns positive (penalty) below 15 %', () => {
    // 5 % → (15 - 5) * 0.015 = +0.150
    expect(calculateHorseWinPercentageAdjustment(500)).toBeCloseTo(0.15, 5);
  });
});

describe('calculateEarningsPerStartAdjustment', () => {
  it('returns 0 at baseline 3 000 SEK  (300 000 öre)', () => {
    expect(calculateEarningsPerStartAdjustment(300_000)).toBeCloseTo(0, 5);
  });

  it('returns positive (penalty) for low earner', () => {
    // 1 500 SEK → (3000 - 1500) * 0.00001 = +0.015
    expect(calculateEarningsPerStartAdjustment(150_000)).toBeCloseTo(0.015, 5);
  });

  it('returns negative (bonus) for high earner', () => {
    // 6 000 SEK → (3000 - 6000) * 0.00001 = -0.030
    expect(calculateEarningsPerStartAdjustment(600_000)).toBeCloseTo(-0.03, 5);
  });
});

describe('calculateFormAdjustment', () => {
  it('returns 0 when no data provided', () => {
    expect(calculateFormAdjustment()).toBe(0);
    expect(calculateFormAdjustment([])).toBe(0);
  });

  it('returns maximum bonus for a perfect recent record (all wins)', () => {
    const races = [
      { place: 1, date: '2024-01-07' },
      { place: 1, date: '2024-01-06' },
      { place: 1, date: '2024-01-05' },
    ];
    const adj = calculateFormAdjustment(races);
    // All FORM_SCORE_WIN = -1.0 → avg = -1.0 → adj = -1.0 * 0.40 = -0.40
    expect(adj).toBeCloseTo(-0.40, 5);
  });

  it('returns penalty for all poor finishes (11+)', () => {
    const races = [
      { place: 12, date: '2024-01-07' },
      { place: 15, date: '2024-01-06' },
    ];
    const adj = calculateFormAdjustment(races);
    // All FORM_SCORE_POOR = 0.6 → avg = 0.6 → adj = 0.6 * 0.40 = +0.24
    expect(adj).toBeCloseTo(0.24, 5);
  });

  it('sorts by date descending — recent races weighted heavier', () => {
    const winRecent = [
      { place: 1,  date: '2024-01-10' }, // most recent → higher weight
      { place: 12, date: '2024-01-01' },
    ];
    const poorRecent = [
      { place: 12, date: '2024-01-10' }, // most recent → higher weight
      { place: 1,  date: '2024-01-01' },
    ];
    const adjWinRecent  = calculateFormAdjustment(winRecent);
    const adjPoorRecent = calculateFormAdjustment(poorRecent);
    // When win is recent, adjustment is more negative (better) than when win is old
    expect(adjWinRecent).toBeLessThan(adjPoorRecent);
  });

  it('handles mixed results correctly (2nd, 5th, 8th)', () => {
    // Single race in each bracket: PLACE, GOOD, MID
    const races = [
      { place: 2, date: '2024-01-03' }, // idx 0 → weight 2^4=16, FORM_SCORE_PLACE = -0.5
      { place: 5, date: '2024-01-02' }, // idx 1 → weight 2^3=8,  FORM_SCORE_GOOD  = -0.2
      { place: 8, date: '2024-01-01' }, // idx 2 → weight 2^2=4,  FORM_SCORE_MID   =  0.3
    ];
    // formScore = (-0.5*16) + (-0.2*8) + (0.3*4) = -8 - 1.6 + 1.2 = -8.4
    // totalWeight = 16+8+4 = 28
    // avg = -8.4/28 = -0.30
    // adj = -0.30 * 0.40 = -0.12
    const adj = calculateFormAdjustment(races);
    expect(adj).toBeCloseTo(-0.12, 4);
  });

  it('fallback uses win-percentage when no race array given', () => {
    // 20 % (as basis points > 100) → pct = 20 → (10 - 20) * 0.01 = -0.10
    expect(calculateFormAdjustment(undefined, 2000)).toBeCloseTo(-0.1, 5);
    // 5 % → (10 - 5) * 0.01 = +0.05
    expect(calculateFormAdjustment(undefined, 500)).toBeCloseTo(0.05, 5);
  });

  it('fallback baseline (10 %) → returns 0', () => {
    expect(calculateFormAdjustment(undefined, 10)).toBeCloseTo(0, 5);
  });

  it('gallop-injected race (place=15) produces a penalty, not zero', () => {
    // A horse whose only recent race was a gallop — horseNormalizationProcessor injects
    // it as { place: 15, date } so the form calc penalises rather than ignoring it.
    // FORM_SCORE_POOR=0.6, FORM_SCALE_S=0.40 → adj = +0.24 (positive = penalty = slower)
    const gallopInjected = [{ place: 15, date: '2026-01-10' }];
    const adj = calculateFormAdjustment(gallopInjected);
    expect(adj).toBeGreaterThan(0);
    expect(adj).toBeCloseTo(0.24, 5);
  });

  // FORM_POOR_THRESHOLD boundary tests (threshold = 9)
  it('place=8 is still MID band → +0.12s (boundary below POOR)', () => {
    // FORM_SCORE_MID=0.3, single race → avg=0.3 → adj=0.3*0.40=+0.12
    const adj = calculateFormAdjustment([{ place: 8, date: '2026-01-10' }]);
    expect(adj).toBeCloseTo(0.12, 5);
  });

  it('place=9 enters POOR band → +0.24s (new lower threshold)', () => {
    // FORM_SCORE_POOR=0.6, single race → avg=0.6 → adj=0.6*0.40=+0.24
    const adj = calculateFormAdjustment([{ place: 9, date: '2026-01-10' }]);
    expect(adj).toBeCloseTo(0.24, 5);
  });

  it('place=10 is POOR (was MID before threshold change) → +0.24s', () => {
    // Before: place 10 was FORM_SCORE_MID (+0.12s). After: FORM_SCORE_POOR (+0.24s).
    const adj = calculateFormAdjustment([{ place: 10, date: '2026-01-10' }]);
    expect(adj).toBeCloseTo(0.24, 5);
  });
});

// ---------------------------------------------------------------------------
// adjustmentCalculators
// ---------------------------------------------------------------------------

describe('calculateDistanceAdjustment', () => {
  it('returns 0 when distances are equal', () => {
    expect(calculateDistanceAdjustment(2140, 2140)).toBe(0);
  });

  it('returns positive when horse prefers longer distance', () => {
    // horse 2500 m, race 2140 m → (2500-2140)*0.001 = +0.360
    expect(calculateDistanceAdjustment(2500, 2140)).toBeCloseTo(0.36, 5);
  });

  it('returns negative when horse prefers shorter distance', () => {
    // horse 1800 m, race 2140 m → (1800-2140)*0.001 = -0.340
    expect(calculateDistanceAdjustment(1800, 2140)).toBeCloseTo(-0.34, 5);
  });
});

describe('calculateRaceDistanceAdjustment', () => {
  it('returns 0 at the 2140 m reference', () => {
    expect(calculateRaceDistanceAdjustment(2140)).toBe(0);
  });

  it('returns 0 within the ±10 m tolerance', () => {
    expect(calculateRaceDistanceAdjustment(2145)).toBe(0);
    expect(calculateRaceDistanceAdjustment(2135)).toBe(0);
  });

  it('returns negative for shorter race (1640 m)', () => {
    // 500 m shorter = 0.5 km → -(0.5 * 3.2) = -1.600
    expect(calculateRaceDistanceAdjustment(1640)).toBeCloseTo(-1.6, 5);
  });

  it('returns positive for longer race (2640 m)', () => {
    // 500 m longer = 0.5 km → 0.5 * 2.0 = +1.000
    expect(calculateRaceDistanceAdjustment(2640)).toBeCloseTo(1.0, 5);
  });

  it('uses asymmetric rates (shorter faster than longer penalty)', () => {
    // -500 m → 1.6 s; +500 m → 1.0 s
    const shorterAdj = Math.abs(calculateRaceDistanceAdjustment(1640));
    const longerAdj  = Math.abs(calculateRaceDistanceAdjustment(2640));
    expect(shorterAdj).toBeGreaterThan(longerAdj);
  });
});

describe('calculateTrackFamiliarityAdjustment', () => {
  it('returns HOME_TRACK_ADJ_S (-0.15) for matching track', () => {
    expect(calculateTrackFamiliarityAdjustment('Solvalla', 'Solvalla')).toBeCloseTo(-0.15, 5);
  });

  it('is case-insensitive', () => {
    expect(calculateTrackFamiliarityAdjustment('solvalla', 'SOLVALLA')).toBeCloseTo(-0.15, 5);
    expect(calculateTrackFamiliarityAdjustment('  Åby  ', '  åby  ')).toBeCloseTo(-0.15, 5);
  });

  it('returns 0 for different tracks', () => {
    expect(calculateTrackFamiliarityAdjustment('Solvalla', 'Jägersro')).toBe(0);
  });

  it('returns 0 when either value is empty/missing', () => {
    expect(calculateTrackFamiliarityAdjustment('', 'Solvalla')).toBe(0);
    expect(calculateTrackFamiliarityAdjustment('Solvalla', '')).toBe(0);
  });
});

describe('calculateVolteStartDistancePenalty', () => {
  it('returns 0 for non-volte start methods', () => {
    expect(calculateVolteStartDistancePenalty('auto', 2200, 2140)).toBe(0);
    expect(calculateVolteStartDistancePenalty('',     2200, 2140)).toBe(0);
  });

  it('returns 0 in a volte when horse distance ≤ race distance', () => {
    expect(calculateVolteStartDistancePenalty('volte', 2140, 2140)).toBe(0);
    expect(calculateVolteStartDistancePenalty('volte', 2000, 2140)).toBe(0);
  });

  it('returns VOLTE_BACK_MARKER_PENALTY_S (+0.40) when back-marker in volte', () => {
    expect(calculateVolteStartDistancePenalty('volte', 2200, 2140)).toBeCloseTo(0.4, 5);
  });

  it('matches case-insensitively on "volte"', () => {
    expect(calculateVolteStartDistancePenalty('Volte', 2200, 2140)).toBeCloseTo(0.4, 5);
    expect(calculateVolteStartDistancePenalty('VOLTE START', 2200, 2140)).toBeCloseTo(0.4, 5);
  });
});

// ---------------------------------------------------------------------------
// adjustmentCalculators — calculateTripDependencyModifier
// ---------------------------------------------------------------------------

describe('calculateTripDependencyModifier', () => {
  it('returns 1.0 when no races provided', () => {
    expect(calculateTripDependencyModifier()).toBe(1.0);
    expect(calculateTripDependencyModifier([])).toBe(1.0);
  });

  it('returns 1.0 when fewer than 4 records have a defined postPosition', () => {
    // 3 records with postPosition — below MIN_RECORDS threshold
    const races = [
      { place: 1, date: '2024-01-07', postPosition: 8 },
      { place: 2, date: '2024-01-06', postPosition: 9 },
      { place: 3, date: '2024-01-05', postPosition: 10 },
    ];
    expect(calculateTripDependencyModifier(races)).toBe(1.0);
  });

  it('returns 1.0 when fewer than 2 outside races (postPosition < 7)', () => {
    // 4+ positioned records but all inside (postPosition 1-6)
    const races = [
      { place: 1, date: '2024-01-07', postPosition: 3 },
      { place: 2, date: '2024-01-06', postPosition: 5 },
      { place: 3, date: '2024-01-05', postPosition: 2 },
      { place: 4, date: '2024-01-04', postPosition: 6 },
    ];
    expect(calculateTripDependencyModifier(races)).toBe(1.0);
  });

  it('returns 1.0 when only 1 outside race (below MIN_OUTSIDE)', () => {
    const races = [
      { place: 1, date: '2024-01-07', postPosition: 8 },  // outside
      { place: 2, date: '2024-01-06', postPosition: 3 },  // inside
      { place: 3, date: '2024-01-05', postPosition: 4 },  // inside
      { place: 4, date: '2024-01-04', postPosition: 5 },  // inside
    ];
    expect(calculateTripDependencyModifier(races)).toBe(1.0);
  });

  it('returns 1.0 when statistics-fallback postPosition=1 fills all records', () => {
    // Statistics-fallback records get postPosition=1 — all "inside",
    // so no outside races can be found → 1.0
    const races = [
      { place: 1, date: '2024-01-07', postPosition: 1 },
      { place: 2, date: '2024-01-06', postPosition: 1 },
      { place: 3, date: '2024-01-05', postPosition: 1 },
      { place: 4, date: '2024-01-04', postPosition: 1 },
      { place: 5, date: '2024-01-03', postPosition: 1 },
    ];
    expect(calculateTripDependencyModifier(races)).toBe(1.0);
  });

  it('returns 1.0 when outside place rate is 0% (no places from outside)', () => {
    // 4 outside races, 0 places → outsidePlaceRate=0 → modifier=1.0-0*0.5=1.0
    const races = [
      { place: 6, date: '2024-01-07', postPosition: 8 },
      { place: 7, date: '2024-01-06', postPosition: 9 },
      { place: 8, date: '2024-01-05', postPosition: 10 },
      { place: 9, date: '2024-01-04', postPosition: 7 },
    ];
    expect(calculateTripDependencyModifier(races)).toBeCloseTo(1.0, 5);
  });

  it('returns 0.75 for 50% outside place rate', () => {
    // 4 outside races, 2 placed (top-3) → outsidePlaceRate=0.5
    // modifier = max(1.0 - 0.5*0.5, 0.6) = max(0.75, 0.6) = 0.75
    const races = [
      { place: 1, date: '2024-01-07', postPosition: 8 },  // placed
      { place: 3, date: '2024-01-06', postPosition: 9 },  // placed
      { place: 5, date: '2024-01-05', postPosition: 7 },  // not placed
      { place: 8, date: '2024-01-04', postPosition: 10 }, // not placed
    ];
    expect(calculateTripDependencyModifier(races)).toBeCloseTo(0.75, 5);
  });

  it('returns 0.6 (clamped) for 100% outside place rate', () => {
    // 4 outside races, all placed → outsidePlaceRate=1.0
    // raw = 1.0 - 1.0*0.5 = 0.5 → clamped to 0.6
    const races = [
      { place: 1, date: '2024-01-07', postPosition: 8 },
      { place: 2, date: '2024-01-06', postPosition: 9 },
      { place: 3, date: '2024-01-05', postPosition: 7 },
      { place: 1, date: '2024-01-04', postPosition: 10 },
    ];
    expect(calculateTripDependencyModifier(races)).toBeCloseTo(0.6, 5);
  });

  it('returns 0.6 (clamped) for 80% outside place rate', () => {
    // 5 outside races, 4 placed → outsidePlaceRate=0.8
    // modifier = max(1.0 - 0.8*0.5, 0.6) = max(0.6, 0.6) = 0.6
    const races = [
      { place: 1, date: '2024-01-07', postPosition: 8 },
      { place: 2, date: '2024-01-06', postPosition: 9 },
      { place: 3, date: '2024-01-05', postPosition: 7 },
      { place: 1, date: '2024-01-04', postPosition: 11 },
      { place: 5, date: '2024-01-03', postPosition: 8 }, // not placed
    ];
    expect(calculateTripDependencyModifier(races)).toBeCloseTo(0.6, 5);
  });

  it('ignores records with undefined postPosition when counting outside races', () => {
    // 4 records total, but 2 have undefined postPosition — only 2 counted
    // → below MIN_RECORDS (4) → 1.0
    const races = [
      { place: 1, date: '2024-01-07', postPosition: 8 },
      { place: 2, date: '2024-01-06', postPosition: 9 },
      { place: 3, date: '2024-01-05' },              // no postPosition
      { place: 4, date: '2024-01-04' },              // no postPosition
    ];
    expect(calculateTripDependencyModifier(races)).toBe(1.0);
  });

  it('only counts postPosition ≥ 7 as outside (not 6)', () => {
    // postPosition=6 is NOT outside — all inside → no outside → 1.0
    const races = [
      { place: 1, date: '2024-01-07', postPosition: 6 },
      { place: 1, date: '2024-01-06', postPosition: 6 },
      { place: 1, date: '2024-01-05', postPosition: 6 },
      { place: 1, date: '2024-01-04', postPosition: 6 },
    ];
    expect(calculateTripDependencyModifier(races)).toBe(1.0);
  });

  it('correctly identifies postPosition=7 as outside', () => {
    // Exactly threshold: postPosition=7 counts as outside
    const races = [
      { place: 1, date: '2024-01-07', postPosition: 7 },
      { place: 2, date: '2024-01-06', postPosition: 7 },
      { place: 3, date: '2024-01-05', postPosition: 3 }, // inside
      { place: 4, date: '2024-01-04', postPosition: 2 }, // inside
    ];
    // 2 outside races both placed → outsidePlaceRate=1.0 → max(0.5, 0.6)=0.6
    expect(calculateTripDependencyModifier(races)).toBeCloseTo(0.6, 5);
  });
});

// ---------------------------------------------------------------------------
// driverCalculators
// ---------------------------------------------------------------------------

describe('calculateDriverAdjustment', () => {
  it('returns 0 at baseline 12 %  (fraction format)', () => {
    expect(calculateDriverAdjustment(0.12)).toBeCloseTo(0, 5);
  });

  it('returns 0 at baseline 12 %  (percent format)', () => {
    expect(calculateDriverAdjustment(12)).toBeCloseTo(0, 5);
  });

  it('returns 0 at baseline 1 200 basis-points', () => {
    expect(calculateDriverAdjustment(1200)).toBeCloseTo(0, 5);
  });

  it('returns positive (penalty) for below-average driver (9 %)', () => {
    // x = (0.09 - 0.12) / 0.10 = -0.3 → adj = -0.30 * tanh(-0.3) ≈ +0.0874
    const adj = calculateDriverAdjustment(9);
    expect(adj).toBeGreaterThan(0);
    expect(adj).toBeCloseTo(0.0874, 3);
  });

  it('returns negative (bonus) for above-average driver (15 %)', () => {
    // x = (0.15 - 0.12) / 0.10 = 0.3 → adj = -0.30 * tanh(0.3) ≈ -0.0874
    const adj = calculateDriverAdjustment(15);
    expect(adj).toBeLessThan(0);
    expect(adj).toBeCloseTo(-0.0874, 3);
  });

  it('saturates near -0.30 for extremely high driver win rate', () => {
    // 60 % → x = (0.60-0.12)/0.10 = 4.8, tanh(4.8) ≈ 1 → adj ≈ -0.30
    const highAdj = calculateDriverAdjustment(60);
    expect(highAdj).toBeLessThan(-0.28);
    expect(highAdj).toBeGreaterThanOrEqual(-0.30);
  });

  it('positive side is bounded even at 0 % win rate', () => {
    // 0 % → x = (0-0.12)/0.10 = -1.2, tanh(-1.2) ≈ -0.834 → adj ≈ +0.25
    // (positive side can't fully saturate because win rate can't go negative)
    const lowAdj = calculateDriverAdjustment(0);
    expect(lowAdj).toBeGreaterThan(0.20);
    expect(lowAdj).toBeLessThanOrEqual(0.30);
  });

  it('handles non-finite input gracefully', () => {
    // NaN treated as 0 → 0 % driver; very below baseline → positive
    const adj = calculateDriverAdjustment(NaN);
    expect(Number.isFinite(adj)).toBe(true);
  });

  it('adjustment magnitude is symmetric around baseline', () => {
    // 9 % penalty should equal 15 % bonus in magnitude
    expect(calculateDriverAdjustment(9)).toBeCloseTo(-calculateDriverAdjustment(15), 5);
  });
});

// ---------------------------------------------------------------------------
// adjustmentCalculators — calculateGallopReliabilityPenalty
// ---------------------------------------------------------------------------

describe('calculateGallopReliabilityPenalty', () => {
  it('returns 0 when horse has no gallops or disqualifications', () => {
    expect(calculateGallopReliabilityPenalty(0, 0)).toBe(0);
  });

  it('returns 0 when called with no arguments (all default to 0)', () => {
    expect(calculateGallopReliabilityPenalty()).toBe(0);
  });

  it('applies 0.15 s per gallop (1 gallop)', () => {
    expect(calculateGallopReliabilityPenalty(1, 0)).toBeCloseTo(0.15, 5);
  });

  it('applies 0.15 s per gallop (2 gallops)', () => {
    expect(calculateGallopReliabilityPenalty(2, 0)).toBeCloseTo(0.30, 5);
  });

  it('applies 0.10 s per disqualification (1 disq)', () => {
    expect(calculateGallopReliabilityPenalty(0, 1)).toBeCloseTo(0.10, 5);
  });

  it('combines gallop and disq penalties', () => {
    // 1 gallop (0.15) + 1 disq (0.10) = 0.25 s
    expect(calculateGallopReliabilityPenalty(1, 1)).toBeCloseTo(0.25, 5);
  });

  it('caps at GALLOP_RELIABILITY_MAX_PENALTY_S (0.50 s)', () => {
    // 4 gallops = 0.60 s → capped at 0.50
    expect(calculateGallopReliabilityPenalty(4, 0)).toBeCloseTo(0.50, 5);
  });

  it('caps combined penalty at 0.50 s', () => {
    // 3 gallops (0.45) + 2 disqs (0.20) = 0.65 → capped at 0.50
    expect(calculateGallopReliabilityPenalty(3, 2)).toBeCloseTo(0.50, 5);
  });

  it('returns a positive value (penalty, never a bonus)', () => {
    expect(calculateGallopReliabilityPenalty(1, 0)).toBeGreaterThan(0);
    expect(calculateGallopReliabilityPenalty(0, 1)).toBeGreaterThan(0);
  });

  it('penalty is monotonically increasing with gallop count (before cap)', () => {
    const p1 = calculateGallopReliabilityPenalty(1, 0);
    const p2 = calculateGallopReliabilityPenalty(2, 0);
    const p3 = calculateGallopReliabilityPenalty(3, 0);
    expect(p2).toBeGreaterThan(p1);
    expect(p3).toBeGreaterThan(p2);
  });
});

// ---------------------------------------------------------------------------
// performanceCalculators — calculateLayoffAdjustment
// ---------------------------------------------------------------------------
// Constants: LAYOFF_THRESHOLD_DAYS=14, LAYOFF_SCALE_DAYS=30, LAYOFF_MAX_S=0.35
// Formula: 0.35 * tanh((days - 14) / 30)  when days > 14, else 0

describe('calculateLayoffAdjustment', () => {
  it('returns 0 for 0 days (fresh horse)', () => {
    expect(calculateLayoffAdjustment(0)).toBe(0);
  });

  it('returns ~0.080 s at 21 days (above new 14d threshold)', () => {
    // excess=7, 0.35 * tanh(7/30) ≈ 0.35 * 0.2282 ≈ 0.080
    expect(calculateLayoffAdjustment(21)).toBeCloseTo(0.080, 2);
  });

  it('returns 0 at exactly the new threshold (14 days)', () => {
    expect(calculateLayoffAdjustment(14)).toBe(0);
  });

  it('returns 0 for non-finite input', () => {
    expect(calculateLayoffAdjustment(NaN)).toBe(0);
    expect(calculateLayoffAdjustment(Infinity)).toBe(0);
  });

  it('returns small penalty just above threshold (15 days → ~0.012 s)', () => {
    // excess=1, 0.35 * tanh(1/30) ≈ 0.01166
    const adj = calculateLayoffAdjustment(15);
    expect(adj).toBeGreaterThan(0);
    expect(adj).toBeCloseTo(0.012, 2);
  });

  it('returns ~0.267 s at one scale-unit past threshold (44 days)', () => {
    // excess=30, 0.35 * tanh(1) ≈ 0.35 * 0.7616 = 0.267
    expect(calculateLayoffAdjustment(44)).toBeCloseTo(0.267, 2);
  });

  it('returns ~0.343 s for a 90-day layoff', () => {
    // excess=76, 0.35 * tanh(76/30) ≈ 0.35 * 0.9872 ≈ 0.345 (within toBeCloseTo precision)
    expect(calculateLayoffAdjustment(90)).toBeCloseTo(0.343, 2);
  });

  it('approaches LAYOFF_MAX_S (0.35 s) asymptotically for very long layoffs', () => {
    // excess=166, 0.35 * tanh(166/30) ≈ 0.35 * 1.0000 ≈ 0.350
    const adj = calculateLayoffAdjustment(180);
    expect(adj).toBeGreaterThan(0.34);
    expect(adj).toBeLessThanOrEqual(0.35);
  });

  it('is always positive (penalty, never a bonus)', () => {
    expect(calculateLayoffAdjustment(22)).toBeGreaterThan(0);
    expect(calculateLayoffAdjustment(60)).toBeGreaterThan(0);
    expect(calculateLayoffAdjustment(365)).toBeGreaterThan(0);
  });

  it('is monotonically increasing with days beyond threshold', () => {
    const d30 = calculateLayoffAdjustment(30);
    const d60 = calculateLayoffAdjustment(60);
    const d90 = calculateLayoffAdjustment(90);
    expect(d60).toBeGreaterThan(d30);
    expect(d90).toBeGreaterThan(d60);
  });
});
