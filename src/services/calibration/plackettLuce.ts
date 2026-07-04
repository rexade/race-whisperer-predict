/**
 * Plackett–Luce ranking likelihood.
 *
 * Models a race finish as sequential choice: the winner is drawn from all
 * runners with probability softmax(strength), the runner-up from the rest,
 * and so on. The log-likelihood of the observed order uses every placing —
 * roughly 10× the training signal of winner-only metrics like MRR — and is
 * smooth in the underlying strengths, which helps small-step optimizers.
 *
 * Strengths here are derived from predicted km-times: faster predicted time
 * = higher strength (see evaluateWeights).
 */

/**
 * Log-likelihood of a finish order under the Plackett–Luce model.
 *
 * @param strengthsInFinishOrder  Horse strengths sorted by ACTUAL finish
 *                                (index 0 = winner). Any real numbers;
 *                                translation-invariant.
 * @param topK                    Only the first topK choice events count —
 *                                deep-field ordering is noise in trot racing.
 * @returns  Sum of log P(choice) over the first topK placings; 0 when fewer
 *           than 2 horses. Higher (closer to 0) = better fit.
 */
export function plackettLuceLogLik(strengthsInFinishOrder: number[], topK: number): number {
  const n = strengthsInFinishOrder.length;
  if (n < 2) return 0;

  // Stabilize exp() by subtracting the max strength (translation-invariant)
  const maxS = Math.max(...strengthsInFinishOrder);
  const exps = strengthsInFinishOrder.map(s => Math.exp(s - maxS));

  let remaining = 0;
  for (const e of exps) remaining += e;

  let logLik = 0;
  const events = Math.min(topK, n - 1);
  for (let i = 0; i < events; i++) {
    logLik += Math.log(exps[i] / remaining);
    remaining -= exps[i];
    if (remaining <= 0) break; // numerical guard
  }
  return logLik;
}
