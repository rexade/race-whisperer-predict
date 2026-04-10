// @vitest-environment node
/**
 * Unit tests for computeConfidenceFlags.
 *
 * Each flag is tested independently plus a combined scenario.
 * Scores are not affected — only annotations change.
 */
import { describe, it, expect } from 'vitest';
import { computeConfidenceFlags, hasAnyFlag, NO_FLAGS, computeReliabilityScore } from '../confidenceFlags';
import type { HorseRawKmTime } from '../../../../services/types/kmTimeTypes';

const ZERO_TIME = { minutes: 0, seconds: 0, tenths: 0 };
const GOOD_TIME = { minutes: 1, seconds: 11, tenths: 5 };

const TODAY = new Date('2026-04-10');

// Helper: build a minimal HorseRawKmTime
function makeRawTimeData(overrides: Partial<HorseRawKmTime> = {}): HorseRawKmTime {
  return {
    horseId: 1,
    horseName: 'Test Horse',
    allTimes: [],
    bestTime: GOOD_TIME,
    bestRecordTime: GOOD_TIME,
    validTimesCount: 8,
    gallopCount: 0,
    disqualificationCount: 0,
    newestRecordDate: '2026-03-15', // 26 days ago — fresh
    ...overrides,
  };
}

describe('computeConfidenceFlags', () => {
  describe('noKmTime', () => {
    it('raises flag when rawKmTime is null', () => {
      const flags = computeConfidenceFlags(makeRawTimeData(), null, 2500, TODAY);
      expect(flags.noKmTime).toBe(true);
    });

    it('raises flag when rawKmTime is undefined', () => {
      const flags = computeConfidenceFlags(makeRawTimeData(), undefined, 2500, TODAY);
      expect(flags.noKmTime).toBe(true);
    });

    it('raises flag when rawKmTime is zero', () => {
      const flags = computeConfidenceFlags(makeRawTimeData(), ZERO_TIME, 2500, TODAY);
      expect(flags.noKmTime).toBe(true);
    });

    it('does not raise flag when rawKmTime is valid', () => {
      const flags = computeConfidenceFlags(makeRawTimeData(), GOOD_TIME, 2500, TODAY);
      expect(flags.noKmTime).toBe(false);
    });
  });

  describe('lowSampleSize', () => {
    it('raises flag when validTimesCount < 5 and km time is present', () => {
      const flags = computeConfidenceFlags(
        makeRawTimeData({ validTimesCount: 3 }),
        GOOD_TIME,
        2500,
        TODAY
      );
      expect(flags.lowSampleSize).toBe(true);
      expect(flags.validTimesCount).toBe(3);
    });

    it('does not raise flag when validTimesCount === 5', () => {
      const flags = computeConfidenceFlags(
        makeRawTimeData({ validTimesCount: 5 }),
        GOOD_TIME,
        2500,
        TODAY
      );
      expect(flags.lowSampleSize).toBe(false);
    });

    it('does not raise flag when validTimesCount > 5', () => {
      const flags = computeConfidenceFlags(
        makeRawTimeData({ validTimesCount: 10 }),
        GOOD_TIME,
        2500,
        TODAY
      );
      expect(flags.lowSampleSize).toBe(false);
    });

    it('does not raise lowSampleSize when noKmTime is also true', () => {
      // noKmTime takes precedence — not meaningful to say "thin data" when there is NO data
      const flags = computeConfidenceFlags(
        makeRawTimeData({ validTimesCount: 2 }),
        null,
        2500,
        TODAY
      );
      expect(flags.noKmTime).toBe(true);
      expect(flags.lowSampleSize).toBe(false);
    });
  });

  describe('noDriverStats', () => {
    it('raises flag when driver win pct is undefined', () => {
      const flags = computeConfidenceFlags(makeRawTimeData(), GOOD_TIME, undefined, TODAY);
      expect(flags.noDriverStats).toBe(true);
    });

    it('raises flag when driver win pct is null', () => {
      const flags = computeConfidenceFlags(makeRawTimeData(), GOOD_TIME, null, TODAY);
      expect(flags.noDriverStats).toBe(true);
    });

    it('raises flag when driver win pct is 0', () => {
      const flags = computeConfidenceFlags(makeRawTimeData(), GOOD_TIME, 0, TODAY);
      expect(flags.noDriverStats).toBe(true);
    });

    it('does not raise flag when driver win pct is present and non-zero', () => {
      const flags = computeConfidenceFlags(makeRawTimeData(), GOOD_TIME, 1800, TODAY);
      expect(flags.noDriverStats).toBe(false);
    });
  });

  describe('gallopRisk', () => {
    it('raises flag when gallopCount >= 2', () => {
      const flags = computeConfidenceFlags(
        makeRawTimeData({ gallopCount: 2 }),
        GOOD_TIME,
        2500,
        TODAY
      );
      expect(flags.gallopRisk).toBe(true);
      expect(flags.gallopCount).toBe(2);
    });

    it('raises flag when gallopCount > 2', () => {
      const flags = computeConfidenceFlags(
        makeRawTimeData({ gallopCount: 5 }),
        GOOD_TIME,
        2500,
        TODAY
      );
      expect(flags.gallopRisk).toBe(true);
    });

    it('does not raise flag when gallopCount === 1', () => {
      const flags = computeConfidenceFlags(
        makeRawTimeData({ gallopCount: 1 }),
        GOOD_TIME,
        2500,
        TODAY
      );
      expect(flags.gallopRisk).toBe(false);
    });

    it('does not raise flag when gallopCount === 0', () => {
      const flags = computeConfidenceFlags(
        makeRawTimeData({ gallopCount: 0 }),
        GOOD_TIME,
        2500,
        TODAY
      );
      expect(flags.gallopRisk).toBe(false);
    });

    it('does not raise flag when rawTimeData is undefined', () => {
      const flags = computeConfidenceFlags(undefined, GOOD_TIME, 2500, TODAY);
      expect(flags.gallopRisk).toBe(false);
      expect(flags.gallopCount).toBe(0);
    });
  });

  describe('staleForm', () => {
    it('raises flag when newest race is 91 days ago', () => {
      const staleDate = new Date(TODAY);
      staleDate.setDate(staleDate.getDate() - 91);
      const flags = computeConfidenceFlags(
        makeRawTimeData({ newestRecordDate: staleDate.toISOString().split('T')[0] }),
        GOOD_TIME,
        2500,
        TODAY
      );
      expect(flags.staleForm).toBe(true);
    });

    it('does not raise flag when newest race is 89 days ago', () => {
      const freshDate = new Date(TODAY);
      freshDate.setDate(freshDate.getDate() - 89);
      const flags = computeConfidenceFlags(
        makeRawTimeData({ newestRecordDate: freshDate.toISOString().split('T')[0] }),
        GOOD_TIME,
        2500,
        TODAY
      );
      expect(flags.staleForm).toBe(false);
    });

    it('does not raise flag when newestRecordDate is undefined', () => {
      const flags = computeConfidenceFlags(
        makeRawTimeData({ newestRecordDate: undefined }),
        GOOD_TIME,
        2500,
        TODAY
      );
      expect(flags.staleForm).toBe(false);
    });

    it('does not raise flag when rawTimeData is undefined', () => {
      const flags = computeConfidenceFlags(undefined, GOOD_TIME, 2500, TODAY);
      expect(flags.staleForm).toBe(false);
    });
  });

  describe('clean horse (no flags)', () => {
    it('produces no flags for a horse with good data', () => {
      const flags = computeConfidenceFlags(
        makeRawTimeData({ validTimesCount: 8, gallopCount: 0, newestRecordDate: '2026-03-15' }),
        GOOD_TIME,
        2500,
        TODAY
      );
      expect(flags.noKmTime).toBe(false);
      expect(flags.lowSampleSize).toBe(false);
      expect(flags.noDriverStats).toBe(false);
      expect(flags.gallopRisk).toBe(false);
      expect(flags.staleForm).toBe(false);
      expect(hasAnyFlag(flags)).toBe(false);
    });
  });

  describe('NO_FLAGS constant', () => {
    it('has no flags raised', () => {
      expect(hasAnyFlag(NO_FLAGS)).toBe(false);
    });

    it('has zero counts', () => {
      expect(NO_FLAGS.validTimesCount).toBe(0);
      expect(NO_FLAGS.gallopCount).toBe(0);
    });
  });

  describe('combined scenario', () => {
    it('can raise multiple flags simultaneously', () => {
      const flags = computeConfidenceFlags(
        makeRawTimeData({ validTimesCount: 2, gallopCount: 3, newestRecordDate: '2025-10-01' }),
        GOOD_TIME,
        0, // no driver stats
        TODAY
      );
      expect(flags.lowSampleSize).toBe(true);
      expect(flags.gallopRisk).toBe(true);
      expect(flags.staleForm).toBe(true);
      expect(flags.noDriverStats).toBe(true);
      expect(flags.noKmTime).toBe(false);
      expect(hasAnyFlag(flags)).toBe(true);
    });
  });
});

describe('computeReliabilityScore', () => {
  it('returns 5 for a horse with no issues', () => {
    // No deductions: normalized time, local history, good multiplier, no flags
    expect(computeReliabilityScore(NO_FLAGS, 'normalized', false, 'local', 0.8)).toBe(5);
  });

  it('returns 2 when timeSource is none', () => {
    // 5 - 3 = 2
    expect(computeReliabilityScore(NO_FLAGS, 'none', false, 'local', undefined)).toBe(2);
  });

  it('clamps to 1 when timeSource none stacks with other penalties', () => {
    // 5 - 3 (none) - 0.5 (gallop) - 0.5 (stale) = 1
    const flags = { ...NO_FLAGS, gallopRisk: true, gallopCount: 2, staleForm: true };
    expect(computeReliabilityScore(flags, 'none', false, 'local', undefined)).toBe(1);
  });

  it('returns 4 when uncertain (best-raw fallback)', () => {
    // 5 - 1 = 4
    expect(computeReliabilityScore(NO_FLAGS, 'best_raw', true, 'local', undefined)).toBe(4);
  });

  it('returns 3 when uncertain with gallop risk and stale form', () => {
    // 5 - 1 (uncertain) - 0.5 (gallop) - 0.5 (stale) = 3
    const flags = { ...NO_FLAGS, gallopRisk: true, gallopCount: 2, staleForm: true };
    expect(computeReliabilityScore(flags, 'best_raw', true, 'local', undefined)).toBe(3);
  });

  it('returns 4 when only abroad history', () => {
    // 5 - 1 = 4
    expect(computeReliabilityScore(NO_FLAGS, 'normalized', false, 'abroad', undefined)).toBe(4);
  });

  it('returns 4 when only low confidence multiplier', () => {
    // 5 - 0.5 = 4.5, floor = 4
    expect(computeReliabilityScore(NO_FLAGS, 'normalized', false, 'local', 0.3)).toBe(4);
  });

  it('does not penalise when confidenceMultiplier is exactly 0.5', () => {
    // boundary: 0.5 is NOT < 0.5, so no penalty
    expect(computeReliabilityScore(NO_FLAGS, 'normalized', false, 'local', 0.5)).toBe(5);
  });

  it('clamps to 1 for worst-case combination', () => {
    // 5 - 3 (none) - 1 (abroad) - 0.5 (multiplier) - 0.5 (gallop) - 0.5 (stale) - 0.5 (thin) - 0.5 (driver) = -1.5 → 1
    const flags = {
      ...NO_FLAGS,
      gallopRisk: true, gallopCount: 3,
      staleForm: true,
      lowSampleSize: true, validTimesCount: 2,
      noDriverStats: true,
    };
    expect(computeReliabilityScore(flags, 'none', false, 'abroad', 0.3)).toBe(1);
  });

  it('handles undefined flags gracefully', () => {
    expect(computeReliabilityScore(undefined, 'normalized', false, 'local', undefined)).toBe(5);
  });

  it('handles undefined timeSource and historySource', () => {
    // No deductions when both primary fields are undefined
    expect(computeReliabilityScore(NO_FLAGS, undefined, undefined, undefined, undefined)).toBe(5);
  });
});
