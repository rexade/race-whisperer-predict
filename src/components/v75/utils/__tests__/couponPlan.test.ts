import { describe, expect, it } from 'vitest';
import { coveragePlan, DEFAULT_BUDGET_KR, SPIK_MAX_ODDS } from '../couponPlan';

/** Minimal shape of what the analyser produces, enough to rank and cover. */
const horse = (seconds: number, n: number, liveOdds?: number) => ({
  horseKey: `h${n}`,
  liveOdds,
  startNumber: n,
  postPosition: n,
  modernNormalizedResult: {
    modernNormalizedTime: { minutes: Math.floor(seconds / 60), seconds: Math.floor(seconds % 60), tenths: Math.round((seconds % 1) * 10) },
  },
});

const race = (raceId: string, gaps: number[], topOdds?: number) => ({
  raceId,
  analysisComplete: true,
  horses: gaps.map((g, i) => horse(72 + g, i + 1, i === 0 ? topOdds : undefined)),
});

describe('coveragePlan', () => {
  it('covers the open leg deeper than the settled one', () => {
    // The whole reason the ticket layer exists: a leg where the model has a
    // clear leader does not deserve the same money as one where it does not.
    // Eight legs, so 500 rows is genuinely scarce and the allocator has to
    // choose. With only two legs it can afford every horse in both and the
    // trade-off never appears.
    const settled = race('r-settled', [0, 4.0, 5.0, 6.0, 7.0, 8.0]);
    const open = race('r-open', [0, 0.1, 0.2, 0.4, 0.6, 0.9]);
    const middling = Array.from({ length: 6 }, (_, i) => race(`r${i}`, [0, 0.8, 1.4, 2.0, 2.6, 3.2]));

    const plan = coveragePlan([settled, open, ...middling] as never, DEFAULT_BUDGET_KR);

    expect(plan.get('r-open')!).toBeGreaterThan(plan.get('r-settled')!);
  });

  it('keeps the whole coupon inside the budget', () => {
    const races = Array.from({ length: 8 }, (_, i) => race(`r${i}`, [0, 0.3, 0.5, 0.8, 1.2, 1.6]));

    const plan = coveragePlan(races as never, DEFAULT_BUDGET_KR);
    const rows = [...plan.values()].reduce((a, b) => a * b, 1);

    expect(rows).toBeLessThanOrEqual(DEFAULT_BUDGET_KR / 0.5);
    [...plan.values()].forEach(n => expect(n).toBeGreaterThanOrEqual(1));
  });

  it('leaves a leg that failed to analyse at a single horse', () => {
    // Covering a leg we could not rank would spend rows on an arbitrary order.
    const races = [race('r-ok', [0, 0.2, 0.4]), { raceId: 'r-bad', analysisComplete: false, horses: [] }];

    const plan = coveragePlan(races as never, DEFAULT_BUDGET_KR);

    expect(plan.get('r-bad')).toBe(1);
  });

  it('refuses to single a leg whose top pick is not short enough', () => {
    // The spik decision belongs to the price, not the model's margin. Measured
    // on 603 holdout legs: a top pick at odds <= 2.0 holds 56.3%, one at longer
    // odds far less, and the model's own margin is the weaker signal of the two.
    const wideOpen = Array.from({ length: 6 }, (_, i) => race(`r${i}`, [0, 0.9, 1.5, 2.1, 2.7, 3.3]));
    // Derived from the threshold so moving it cannot silently void this test.
    const dominant = race('r-dominant', [0, 5.0, 6.0, 7.0, 8.0, 9.0], SPIK_MAX_ODDS + 1);
    const shortPriced = race('r-short', [0, 5.0, 6.0, 7.0, 8.0, 9.0], SPIK_MAX_ODDS - 0.5);

    const plan = coveragePlan([dominant, shortPriced, ...wideOpen] as never, DEFAULT_BUDGET_KR);

    expect(plan.get('r-short')).toBe(1);
    expect(plan.get('r-dominant')!).toBeGreaterThanOrEqual(2);
  });

  it('still singles a leg when the price is unknown, rather than refusing', () => {
    // Odds are missing until the pools open. Falling back to a refusal would
    // make every early analysis spikeless and unusable.
    const legs = Array.from({ length: 8 }, (_, i) => race(`r${i}`, i === 0 ? [0, 6, 7, 8, 9, 10] : [0, 0.4, 0.8, 1.2, 1.6, 2.0]));

    const plan = coveragePlan(legs as never, DEFAULT_BUDGET_KR);

    expect(plan.get('r0')).toBe(1);
  });
});
