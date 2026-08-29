/**
 * Evaluate weight configurations on the chronological holdout.
 *
 * Uses the same holdout split as kfold-multistart.ts (most recent ~20% of
 * dates, min 6) so numbers are directly comparable with its report. Configs
 * are JSON files of either a bare NormalizationWeights object or
 * { label?, weights, postPositionCurves? }.
 *
 * Usage:
 *   npx tsx scripts/eval-holdout.ts [dataset.json] [--holdout 0.2] config.json [config2.json …]
 */

import * as fs from 'fs';
import * as path from 'path';
import { NormalizationWeights, DEFAULT_WEIGHTS } from '../src/services/modernKm/types';
import { PostPositionCurves } from '../src/services/modernKm/index';
import { evaluateWeights } from '../src/services/calibration/historicalCalibrationService';
import { chronologicalHoldout } from '../src/services/calibration/datasetSplits';
import { loadDataset, primeDriverRatings } from './cli-common';

interface Config { label: string; weights: NormalizationWeights; curves?: PostPositionCurves }

function loadConfig(file: string): Config {
  const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
  if (raw.weights) {
    return { label: raw.label ?? path.basename(file), weights: raw.weights, curves: raw.postPositionCurves };
  }
  return { label: path.basename(file), weights: raw as NormalizationWeights };
}

async function main() {
  const args = process.argv.slice(2);
  const holdoutIdx = args.indexOf('--holdout');
  const holdoutFrac = holdoutIdx >= 0 ? Number(args[holdoutIdx + 1]) : 0.2;
  const rest = args.filter((a, i) => a !== '--holdout' && i !== holdoutIdx + 1);

  // First positional arg is always the dataset; the rest are config files.
  const datasetPath = rest.shift() ?? 'calibration-dataset-6mo.json';
  const configFiles = rest;

  if (configFiles.length === 0) {
    console.log('Usage: npx tsx scripts/eval-holdout.ts [dataset.json] [--holdout 0.2] config.json …');
    process.exit(1);
  }

  const dataset = loadDataset(datasetPath, { primeDriverRatings: false });
  const { train, holdout } = chronologicalHoldout(dataset, holdoutFrac, 6);
  primeDriverRatings(train);
  const races = holdout.reduce((s, d) => s + d.races.length, 0);
  console.log(`Holdout: ${holdout.length} dates / ${races} races (${holdout[0].date} … ${holdout[holdout.length - 1].date})\n`);

  const configs: Config[] = [
    { label: 'DEFAULT_WEIGHTS', weights: DEFAULT_WEIGHTS },
    ...configFiles.map(loadConfig),
  ];

  // Every config is scored on the same holdout, so one market line describes all
  // of them. Captured from the first evaluation rather than recomputed.
  let market: { winAccuracy: number | null; mrr: number | null; races: number } | undefined;

  for (const cfg of configs) {
    const e = await evaluateWeights(holdout, cfg.weights, cfg.curves);
    market ??= { winAccuracy: e.marketWinAccuracy, mrr: e.marketMRR, races: e.marketRacesEvaluated };
    const edge = e.marketWinAccuracy !== null
      ? `  edge=${((e.winAccuracy - e.marketWinAccuracy) * 100 >= 0 ? '+' : '')}${((e.winAccuracy - e.marketWinAccuracy) * 100).toFixed(1)}pp`
      : '';
    console.log(`${cfg.label.padEnd(45)} MRR=${e.winnerMRR.toFixed(4)}  win=${(e.winAccuracy * 100).toFixed(1)}%  top3=${(e.winnerTop3Accuracy * 100).toFixed(1)}%  top5=${(e.winnerTop5Accuracy * 100).toFixed(1)}%  rankMAE=${e.rankMAE.toFixed(2)}${edge}`);
  }

  // Backing the favourite already wins roughly a third of Swedish trotting races,
  // so a model win rate without this line is unanchored.
  if (market?.winAccuracy != null && market.mrr != null) {
    console.log(`\n${'MARKET (favourite)'.padEnd(45)} MRR=${market.mrr.toFixed(4)}  win=${(market.winAccuracy * 100).toFixed(1)}%  over ${market.races} of ${races} races`);
  } else {
    console.log(`\nMARKET (favourite): no usable odds/betDistribution in this holdout`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
