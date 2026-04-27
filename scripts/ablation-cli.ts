/**
 * Ablation study — zero out each weight from V22, measure impact.
 * Shows which weights are actually helping vs hurting.
 *
 * Usage:
 *   npx tsx scripts/ablation-cli.ts [dataset.json]
 */

import './node-polyfills';
import * as fs from 'fs';
import { NormalizationWeights } from '../src/services/modernKm/types';
import { CalibrationDataset, evaluateWeights } from '../src/services/calibration/historicalCalibrationService';

function hydrateDataset(raw: any[]): CalibrationDataset {
  return raw.map(dateData => ({
    ...dateData,
    races: dateData.races.map((race: any) => ({
      ...race,
      actualResults: new Map(Object.entries(race.actualResults).map(
        ([k, v]) => [Number(k), v]
      )),
    })),
  }));
}

const V22: NormalizationWeights = {
  postPosition: 1.757, shoeType: 0.000, sulkyType: 0.447,
  driverPerformance: 3.470, driverForm: 0.395, driverEmpirical: 0.000,
  trackFamiliarity: 0.393, form: 3.655, distanceAdjustment: 0.838,
  raceDistanceAdjustment: 2.857, volteStartDistancePenalty: 1.237,
  startPoints: 2.162, placePercentage: 0.200, horseWinPercentage: 0.540,
  earningsPerStart: 2.205, gallopRisk: 0.000, layoffPenalty: 1.938,
  ageFactor: 0.000, genderAdjustment: 2.225, consistencyFactor: 1.777,
  trainerPerformance: 2.443,
};

const WEIGHT_KEYS = Object.keys(V22) as (keyof NormalizationWeights)[];

async function main() {
  const datasetPath = process.argv[2] || 'calibration-dataset-6mo.json';
  const raw = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));
  const dataset = hydrateDataset(raw);
  console.log(`Dataset: ${dataset.length} dates, ${dataset.reduce((s, d) => s + d.races.length, 0)} races\n`);

  // Baseline
  const baseline = await evaluateWeights(dataset, V22);
  console.log(`BASELINE (V22):  Win=${(baseline.winAccuracy * 100).toFixed(1)}%  MRR=${baseline.winnerMRR.toFixed(3)}\n`);

  // Ablation: zero each weight
  console.log('ABLATION — zeroing each weight from V22:');
  console.log('─'.repeat(80));

  const results: { key: string; win: number; mrr: number; delta: number; origVal: number }[] = [];

  for (const key of WEIGHT_KEYS) {
    if (V22[key] === 0) continue; // Already zero, skip

    const modified = { ...V22, [key]: 0 };
    const result = await evaluateWeights(dataset, modified);
    const delta = result.winAccuracy - baseline.winAccuracy;
    results.push({
      key,
      win: result.winAccuracy * 100,
      mrr: result.winnerMRR,
      delta: delta * 100,
      origVal: V22[key],
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
    const half = { ...V22, [key]: V22[key] * 0.5 };
    const dbl = { ...V22, [key]: Math.min(V22[key] * 2, 5.0) };

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
