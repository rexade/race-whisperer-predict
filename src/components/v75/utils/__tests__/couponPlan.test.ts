import { describe, expect, it } from 'vitest';
import { coveragePlan, DEFAULT_BUDGET_KR } from '../couponPlan';

/** Minimal shape of what the analyser produces, enough to rank and cover. */
const horse = (seconds: number, n: number) => ({
  horseKey: `h${n}`,
  startNumber: n,
  postPosition: n,
  modernNormalizedResult: {
    modernNormalizedTime: { minutes: Math.floor(seconds / 60), seconds: Math.floor(seconds % 60), tenths: Math.round((seconds % 1) * 10) },
  },
});

const race = (raceId: string, gaps: number[]) => ({
  raceId,
  analysisComplete: true,
  horses: gaps.map((g, i) => horse(72 + g, i + 1)),
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
});
