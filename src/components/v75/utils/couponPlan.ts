/**
 * How many horses to cover in each leg of a card, within a row budget.
 *
 * The bridge between the two layers. The PREDICTION layer has already decided
 * the order and nothing here may change it - this only ever takes the top n of
 * each leg. The TICKET layer answers what the model was never asked: given 500
 * rows, where does one more horse buy the most hit probability?
 *
 * Allocation is a whole-card decision, so this takes every leg at once. A leg
 * with a clear leader and one with six horses covered by a second are worth
 * very different money for the same rows, and an even spread is almost always
 * the wrong answer.
 */
import { sortByPrediction, rankingScoreSeconds } from './raceRanking';
import { calibrateWinProbabilities, allocateBudget } from '@/services/analysis/ticketBudget';
import type { V75RaceResult } from '../hooks/useV75Analysis';

/** V85 is 0.50 kr per row at full stake. */
export const ROW_COST_KR = 0.5;
export const DEFAULT_BUDGET_KR = 250;

/**
 * Fitted on 2159 training races by maximum likelihood of who actually won.
 *
 * Held fixed rather than refitted in the browser, so the coupon the app builds
 * is the one scripts/shadow-ticket.ts measured. That script prints the fitted
 * value on every run - if it stops matching this constant, the measurement no
 * longer describes what you are playing, so copy it across.
 *
 * A second (shape) parameter was measured and cut: it inflated the predicted
 * hit rate from 3.00% to 4.41% against a realised 3.1% and changed no coupon
 * outcome at all.
 */
const TEMPERATURE = 2.869;

/**
 * Longest price the top pick may carry and still be singled.
 *
 * The spik decision belongs to the market, not to the model's own margin.
 * Measured on 603 holdout legs, with training agreeing closely:
 *
 *   top pick at odds <= 1.5   holds 69.6%   ~0.6 legs per card
 *   odds <= 1.8               holds 63.2%   ~1.6
 *   odds <= 2.0               holds 56.3%   ~2.1
 *   model margin >= 3s        holds 55.5%   ~1.9
 *
 * The price matches the model's own margin on accuracy and beats it on how
 * often it is available, which is what decides whether a card has two or three
 * spik candidates at all. Picking spik legs by margin - which is what this did
 * before - held 47.1% against a predicted 56.0%.
 *
 * 2.0 is chosen to leave roughly two singles per card, the count that maximises
 * expected full pott at a 500-row budget.
 */
export const SPIK_MAX_ODDS = 2.0;

export function coveragePlan(
  races: V75RaceResult[],
  budgetKr: number = DEFAULT_BUDGET_KR,
): Map<string, number> {
  const plan = new Map<string, number>();

  // A leg we could not rank gets one horse: spending rows on an arbitrary
  // order is worse than not spending them.
  const usable = races.filter(r => {
    const ok = r.analysisComplete && sortByPrediction(r.horses ?? []).length >= 2;
    if (!ok) plan.set(r.raceId, 1);
    return ok;
  });
  if (usable.length === 0) return plan;

  const probabilities = usable.map(r =>
    calibrateWinProbabilities(sortByPrediction(r.horses).map(rankingScoreSeconds), TEMPERATURE));

  // A leg may only be singled when its top pick is short enough. Odds are
  // absent until the pools open, and a missing price must not silently bar
  // every spik, so unknown falls through to "allowed".
  const minCover = usable.map(r => {
    const odds = sortByPrediction(r.horses)[0]?.liveOdds;
    return typeof odds === 'number' && odds > SPIK_MAX_ODDS ? 2 : 1;
  });

  const counts = allocateBudget(probabilities, Math.floor(budgetKr / ROW_COST_KR), minCover);
  usable.forEach((r, i) => plan.set(r.raceId, counts[i]));
  return plan;
}
