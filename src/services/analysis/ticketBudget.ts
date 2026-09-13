/**
 * Turn predicted km-times into a win-probability distribution over a field.
 *
 * This is a CALIBRATION, not a model. It puts numbers on an order the
 * prediction layer has already decided, and being monotone in predicted time
 * it cannot reorder the field however the temperature is set. That is the
 * contract the ticket engine depends on: the model owns who is best, the
 * ticket engine only decides how deep to cover.
 *
 * Temperature is the only fitted parameter, and deliberately so. A second
 * (shape) parameter was measured and cut: it bought 1.8 of training
 * log-likelihood, changed no actual coupon outcome (2/65 either way), and
 * inflated the predicted hit rate from 3.00% to 4.41% against a realised 3.1%.
 * It made the number lie without making the ticket better.
 *
 * Monotone in predicted time, so it cannot reorder the field however it is
 * fitted - that is the contract the prediction layer depends on.
 */
export const calibrateWinProbabilities = (predictedSeconds: number[], temperature: number): number[] => {
  // Faster is better, so time enters negatively. Shift by the fastest before
  // exponentiating; raw exp(-72/1.5) underflows to zero and loses the field.
  const fastest = Math.min(...predictedSeconds);
  const e = predictedSeconds.map(s => Math.exp(-(s - fastest) / temperature));
  const total = e.reduce((a, b) => a + b, 0);
  return e.map(v => v / total);
};

/**
 * Decide how many of each leg's top-ranked horses to cover, within a row budget.
 *
 * The ticket layer answers a different question from the prediction layer:
 * not "who wins" but "where does the next krona buy the most hit probability".
 * It never reorders anything - it only ever takes the top n of an order the
 * model already fixed.
 *
 * Both quantities are multiplicative across legs (hit probability multiplies,
 * so does cost), so the trade is linear in logs and greedy on
 * d(log hit) / d(log rows) is the natural rule: repeatedly buy the cheapest
 * probability on offer until the budget is gone. An even spread is almost
 * always wrong - a near-settled leg and a wide-open one deserve very different
 * money for the same rows.
 */
export const allocateBudget = (legProbabilities: number[][], maxRows: number): number[] => {
  const counts = legProbabilities.map(() => 1);
  // Cumulative probability that leg i is covered by its top n horses.
  const covered = (leg: number[], n: number) =>
    leg.slice(0, n).reduce((a, b) => a + b, 0);

  let rows = 1;
  for (;;) {
    let bestLeg = -1;
    let bestRatio = 0;
    for (let i = 0; i < legProbabilities.length; i++) {
      const leg = legProbabilities[i];
      const n = counts[i];
      if (n >= leg.length) continue;
      const rowsAfter = (rows / n) * (n + 1);
      if (rowsAfter > maxRows) continue;

      const now = covered(leg, n);
      const next = covered(leg, n + 1);
      if (next <= now || now <= 0) continue;

      // Gain in log hit-probability per unit of log cost.
      const ratio = Math.log(next / now) / Math.log((n + 1) / n);
      if (ratio > bestRatio) { bestRatio = ratio; bestLeg = i; }
    }
    if (bestLeg < 0) return counts;
    rows = (rows / counts[bestLeg]) * (counts[bestLeg] + 1);
    counts[bestLeg]++;
  }
};
