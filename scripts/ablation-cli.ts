/**
 * Ablation study — zero out each weight from V23, measure impact.
 * Shows which weights are actually helping vs hurting.
 *
 * Usage:
 *   npx tsx scripts/ablation-cli.ts [dataset.json]
 */

import { loadDataset } from './cli-common';
import { NormalizationWeights } from '../src/services/modernKm/types';
import { CalibrationDataset, evaluateWeights } from '../src/services/calibration/historicalCalibrationService';

// V23: 5-fold CV multi-start optimized (2026-04-27). CV-Win 34.6%, Full-Win 34.7%, MRR 0.516.
const V23: NormalizationWeights = {
  postPosition: 1.500, shoeType: 0.000, sulkyType: 0.500,
  driverPerformance: 2.200, driverForm: 0.000, driverEmpirical: 0.000,
  trackFamiliarity: 0.000, form: 5.000, distanceAdjustment: 1.000,
  raceDistanceAdjustment: 1.500, volteStartDistancePenalty: 2.200,
  startPoints: 2.500, placePercentage: 0.400, horseWinPercentage: 1.000,
  earningsPerStart: 1.300, gallopRisk: 0.000, layoffPenalty: 1.900,
  ageFactor: 0.000, genderAdjustment: 0.900, consistencyFactor: 2.000,
  trainerPerformance: 1.500,
};

const WEIGHT_KEYS = Object.keys(V23) as (keyof NormalizationWeights)[];

async function main() {
  const datasetPath = process.argv[2] || 'calibration-dataset-6mo.json';
  const dataset = loadDataset(datasetPath);

  // Baseline
  const baseline = await evaluateWeights(dataset, V23);
  console.log(`BASELINE (V23):  Win=${(baseline.winAccuracy * 100).toFixed(1)}%  MRR=${baseline.winnerMRR.toFixed(3)}\n`);

  // Ablation: zero each weight
  console.log('ABLATION — zeroing each weight from V23:');
  console.log('─'.repeat(80));

  const results: { key: string; win: number; mrr: number; delta: number; origVal: number }[] = [];

  for (const key of WEIGHT_KEYS) {
    if (V23[key] === 0) continue; // Already zero, skip

    const modified = { ...V23, [key]: 0 };
    const result = await evaluateWeights(dataset, modified);
    const delta = result.winAccuracy - baseline.winAccuracy;
    results.push({
      key,
      win: result.winAccuracy * 100,
      mrr: result.winnerMRR,
      delta: delta * 100,
      origVal: V23[key],
    });
  }

  // Sort by delta (most harmful removal first = most valuable weight)
  results.sort((a, b) => a.delta - b.delta);

  for (const r of results) {
    const arrow = r.delta > 0 ? '▲' : r.delta < 0 ? '▼' : '=';
    const sign = r.delta > 0 ? '+' : '';
    console.log(
      `  ${arrow} ${r.key.padEnd(28)} was=${r.origVal.toFixed(3)}  → Win=${r.win.toFixed(1).padStart(5)}%  MRR=${r.mrr.toFixed(3)}  Δ=${sign}${r.delta.toFixed(1)}pp`
    );
  }

  console.log('─'.repeat(80));
  console.log('\n▼ = removing hurts (weight is valuable)');
  console.log('▲ = removing helps (weight is HURTING performance!)');

  // Double/halve each weight to see sensitivity
  console.log('\n\nSENSITIVITY — double and halve each non-zero weight:');
  console.log('─'.repeat(90));

  for (const r of results) {
    const key = r.key as keyof NormalizationWeights;
    const half = { ...V23, [key]: V23[key] * 0.5 };
    const dbl = { ...V23, [key]: Math.min(V23[key] * 2, 5.0) };

    const halfResult = await evaluateWeights(dataset, half);
    const dblResult = await evaluateWeights(dataset, dbl);

    const halfDelta = (halfResult.winAccuracy - baseline.winAccuracy) * 100;
    const dblDelta = (dblResult.winAccuracy - baseline.winAccuracy) * 100;

    console.log(
      `  ${key.padEnd(28)} ×0.5→${(halfResult.winAccuracy * 100).toFixed(1).padStart(5)}%(${halfDelta >= 0 ? '+' : ''}${halfDelta.toFixed(1)})  ×2→${(dblResult.winAccuracy * 100).toFixed(1).padStart(5)}%(${dblDelta >= 0 ? '+' : ''}${dblDelta.toFixed(1)})`
    );
  }
  console.log('─'.repeat(90));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
