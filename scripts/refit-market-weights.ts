/**
 * Refit only the three market weights on the TRAIN split, holding every other
 * weight fixed, then report the holdout.
 *
 * Three free parameters on ~250 training races is a defensible fit; refitting
 * all 25 weights on this dataset would just memorise it. Objective is train MRR,
 * which uses the winner's full rank rather than a hit/miss and so is far more
 * sensitive than win% at this sample size.
 */
import * as fs from 'fs';
import { chronologicalHoldout } from '../src/services/calibration/datasetSplits';
import { evaluateWeights } from '../src/services/calibration/historicalCalibrationService';
import { loadDataset, primeDriverRatings } from './cli-common';
import type { NormalizationWeights } from '../src/services/modernKm/types';

function argValue(f: string) { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : undefined; }

// Which weights to tune is a CLI argument so the same honest protocol (fit on
// train, report holdout) can be pointed at any small subset. Keep the subset
// small: this dataset supports a handful of free parameters, not 25.
const DEFAULT_KNOBS = 'oddsLive,betDistribution,oddsHistorical';
const KNOBS = (argValue('--knobs') ?? DEFAULT_KNOBS).split(',').map(s => s.trim()) as Array<keyof NormalizationWeights>;
/**
 * What the search maximises. MRR scores one observation per race -- where the
 * winner landed -- and throws the rest of the finish order away.
 *
 * 'pl' is kept for completeness but MEASURED DEGENERATE as a fit target, and
 * the reason is structural rather than a tuning accident. plLogLik builds
 * strengths as -predSeconds / PL_TAU_SECONDS with tau = 0.5, so a 75s km-time
 * becomes a strength near -150 and a three-second spread across a field becomes
 * roughly a 400:1 probability ratio. The model picks the winner about 39% of
 * the time, so confident-and-wrong dominates the average log-likelihood, and
 * the cheapest way to raise it is to stop predicting: flatten the field until
 * every horse looks alike.
 *
 * Run on 2026-08-31 it did exactly that -- drove oddsLive and betDistribution
 * to 0, discarding the strongest signal in the model -- and scored holdout MRR
 * 0.4625 / win 27.2% against 0.5829 / 39.1% for the MRR-fitted default. Fitting
 * on it requires a tau on the order of the field's time spread first.
 */
const OBJECTIVE = (argValue('--objective') ?? 'mrr') as 'mrr' | 'pl';
const objectiveOf = (e: { winnerMRR: number; plLogLik: number }) =>
  OBJECTIVE === 'pl' ? e.plLogLik : e.winnerMRR;
const COARSE = [0, 0.25, 0.5, 1.0, 1.5, 2.0, 3.0, 5.0];
const GRID = (knob: string): number[] => (knob === 'oddsHistorical' ? [0, 0.25, 0.5, 1.0] : COARSE);

async function main() {
  const cfg = JSON.parse(fs.readFileSync(argValue('--config') ?? 'data/cfg-V41.json', 'utf-8'));
  const dataset = loadDataset(argValue('--dataset') ?? 'calibration-dataset-full.json', { primeDriverRatings: false });
  const { train, holdout } = chronologicalHoldout(dataset, 0.2, 6);
  primeDriverRatings(train);
  console.log(`train ${train.reduce((s, d) => s + d.races.length, 0)} races / holdout ${holdout.reduce((s, d) => s + d.races.length, 0)} races\n`);

  let best: NormalizationWeights = { ...cfg.weights };
  let bestMRR = objectiveOf(await evaluateWeights(train, best, cfg.postPositionCurves));
  console.log(`start  trainMRR=${bestMRR.toFixed(4)}  objective=${OBJECTIVE} tuning: ${KNOBS.join(', ')}`);

  for (let round = 1; round <= 2; round++) {
    for (const knob of KNOBS) {
      for (const value of GRID(knob)) {
        if (value === best[knob]) continue;
        const candidate = { ...best, [knob]: value };
        const mrr = objectiveOf(await evaluateWeights(train, candidate, cfg.postPositionCurves));
        if (mrr > bestMRR) { bestMRR = mrr; best = candidate; console.log(`  r${round} ${knob}=${value} → trainMRR=${mrr.toFixed(4)} *`); }
      }
    }
  }

  console.log(`\nbest   trainMRR=${bestMRR.toFixed(4)}  oddsLive=${best.oddsLive} betDist=${best.betDistribution} oddsHist=${best.oddsHistorical}`);
  const h = await evaluateWeights(holdout, best, cfg.postPositionCurves);
  console.log(`HOLDOUT  MRR=${h.winnerMRR.toFixed(4)}  win=${(h.winAccuracy * 100).toFixed(1)}%  market win=${(h.marketWinAccuracy! * 100).toFixed(1)}%  edge=${((h.winAccuracy - h.marketWinAccuracy!) * 100).toFixed(1)}pp`);
  const out = argValue('--out') ?? 'data/cfg-V41-refit.json';
  fs.writeFileSync(out, JSON.stringify({ label: (cfg.label ?? 'refit') + ' [refit]', weights: best, postPositionCurves: cfg.postPositionCurves }, null, 2));
  console.log('wrote ' + out);
}
main().catch(e => { console.error(e); process.exit(1); });
