/**
 * CLI weight evaluator — runs evaluateWeights on a downloaded calibration dataset.
 *
 * Usage:
 *   npx tsx scripts/evaluate-cli.ts [dataset.json]
 */

import { loadDataset } from './cli-common';
import { NormalizationWeights } from '../src/services/modernKm/types';
import { WEIGHT_PRESETS } from '../src/services/modernKm/presetWeights';
import { CalibrationDataset, evaluateWeights, CalibrationEvaluation } from '../src/services/calibration/historicalCalibrationService';

async function evaluate(dataset: CalibrationDataset, weights: NormalizationWeights, label: string): Promise<CalibrationEvaluation> {
  const result = await evaluateWeights(dataset, weights);
  console.log(
    `  ${label.padEnd(35)} Win=${(result.winAccuracy * 100).toFixed(1).padStart(5)}%  MRR=${result.winnerMRR.toFixed(3)}  Top3=${(result.topPickAccuracy * 100).toFixed(1).padStart(5)}%  Races=${result.racesEvaluated}`
  );
  return result;
}

async function main() {
  const datasetPath = process.argv[2] || 'calibration-dataset-6mo.json';
  const dataset = loadDataset(datasetPath);
  const totalRaces = dataset.reduce((s, d) => s + d.races.length, 0);

  // Equal weights baseline (all = 1.0)
  const EQUAL: NormalizationWeights = {
    postPosition: 1, shoeType: 1, sulkyType: 1,
    driverPerformance: 1, driverForm: 1, driverEmpirical: 1,
    trackFamiliarity: 1, form: 1, distanceAdjustment: 1,
    raceDistanceAdjustment: 1, volteStartDistancePenalty: 1,
    startPoints: 1, placePercentage: 1, horseWinPercentage: 1,
    earningsPerStart: 1, gallopRisk: 1, layoffPenalty: 1,
    ageFactor: 1, genderAdjustment: 1, consistencyFactor: 1,
    trainerPerformance: 1,
  };

  console.log('Evaluating all presets on full dataset:');
  console.log('─'.repeat(90));

  // Evaluate equal-weights baseline first
  await evaluate(dataset, EQUAL, 'Equal (all=1.0)');
  console.log('─'.repeat(90));

  // Evaluate all named presets
  for (const preset of WEIGHT_PRESETS) {
    const shortName = preset.name.length > 33 ? preset.name.slice(0, 33) + '…' : preset.name;
    await evaluate(dataset, preset.weights, shortName);
  }

  console.log('─'.repeat(90));
  console.log(`\nRandom baseline: Win=${(100 / (totalRaces > 0 ? (dataset.reduce((s, d) => s + d.races.reduce((rs, r) => rs + r.raceData.horses.length, 0), 0) / totalRaces) : 10)).toFixed(1)}% (1/avg_field_size)`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
