/**
 * Compare model presets against a named calibration dataset.
 *
 * Usage:
 *   npm run evaluate:models -- [holdout.json] [--ratings-dataset training.json]
 */

import { loadDataset, primeDriverRatings } from './cli-common';
import * as fs from 'fs';
import * as path from 'path';
import { CalibrationDataset } from '../src/services/calibration/historicalCalibrationService';
import { RaceResultProcessor } from '../src/components/v75/services/raceResultProcessor';
import { DEFAULT_WEIGHTS, NormalizationWeights } from '../src/services/modernKm/types';
import { PostPositionCurves } from '../src/services/modernKm';
import { WEIGHT_PRESETS } from '../src/services/modernKm/presetWeights';
import { horseKeyFromRaceHorse } from '../src/services/horseIdentity';

interface ModelCandidate {
  name: string;
  weights: NormalizationWeights;
  postPositionCurves?: PostPositionCurves;
}

interface ModelMetrics {
  name: string;
  winRate: number;
  top3Rate: number;
  winnerTop3Rate: number;
  winnerTop5Rate: number;
  winnerMRR: number;
  rankMAE: number;
  roi: number | null;
  roiBets: number;
  races: number;
  horses: number;
}

function dateRange(dataset: CalibrationDataset): string {
  const dates = dataset.map(d => d.date).filter(Boolean).sort();
  if (dates.length === 0) return 'n/a';
  return dates[0] === dates[dates.length - 1] ? dates[0] : `${dates[0]} to ${dates[dates.length - 1]}`;
}

function uniqueModels(): ModelCandidate[] {
  const models: ModelCandidate[] = [
    { name: 'DEFAULT', weights: DEFAULT_WEIGHTS },
    ...WEIGHT_PRESETS.map(preset => ({
      name: preset.name,
      weights: preset.weights,
      postPositionCurves: preset.postPositionCurves,
    })),
  ];
  const seen = new Set<string>();
  return models.filter(model => {
    if (seen.has(model.name)) return false;
    seen.add(model.name);
    return true;
  });
}

async function evaluateModel(dataset: CalibrationDataset, model: ModelCandidate): Promise<ModelMetrics> {
  let rankError = 0;
  let horses = 0;
  let races = 0;
  let wins = 0;
  let top3 = 0;
  let winnerTop3 = 0;
  let winnerTop5 = 0;
  let winnerMRRSum = 0;
  let winnerRaceCount = 0;
  let roiProfit = 0;
  let roiBets = 0;

  for (const dateData of dataset) {
    for (const race of dateData.races) {
      try {
        const result = await RaceResultProcessor.processRaceResult(
          race.raceData,
          race.rawKmTimes,
          model.weights,
          dateData.date,
          model.postPositionCurves
        );

        if (!result.analysisComplete || result.horses.length === 0) continue;

        // Compress both model and actual ranks after removing display-only estimates.
        // Keeping the original ranks would let an excluded estimate shift every real
        // horse and recreate the evaluation bug fixed in evaluateWeights().
        const realHorses = result.horses.filter(h =>
          !h.modernNormalizedResult?.isEstimated
          && h.modernNormalizedResult?.modernNormalizedTime
        );
        if (realHorses.length === 0) continue;

        const horseKey = (horse: (typeof realHorses)[number]) =>
          horseKeyFromRaceHorse(race.raceId, horse);
        const predictedRankByKey = new Map<string, number>();
        realHorses.forEach((horse, index) => predictedRankByKey.set(horseKey(horse), index + 1));

        const realActualOrder = realHorses
          .map(horse => ({ key: horseKey(horse), actual: race.actualResults.get(horseKey(horse)) }))
          .filter(entry => entry.actual && Number.isFinite(entry.actual.position) && entry.actual.position > 0)
          .sort((a, b) => a.actual!.position - b.actual!.position);
        const actualRankByKey = new Map<string, number>();
        realActualOrder.forEach((entry, index) => actualRankByKey.set(entry.key, index + 1));

        for (const horse of realHorses) {
          const key = horseKey(horse);
          const predictedRank = predictedRankByKey.get(key);
          const actualRank = actualRankByKey.get(key);
          if (predictedRank === undefined || actualRank === undefined) continue;
          rankError += Math.abs(predictedRank - actualRank);
          horses++;
        }

        const topPick = realHorses[0];
        const topPickKey = horseKey(topPick);
        const topPickActual = race.actualResults.get(topPickKey);
        const topPickActualRank = actualRankByKey.get(topPickKey);

        let actualWinnerHorseKey: string | undefined;
        for (const [actualHorseKey, actual] of race.actualResults) {
          if (actual.position === 1) {
            actualWinnerHorseKey = actualHorseKey;
            break;
          }
        }
        const predictedWinnerRank = actualWinnerHorseKey === undefined
          ? undefined
          : predictedRankByKey.get(actualWinnerHorseKey);
        if (predictedWinnerRank !== undefined) {
          races++;
          if (predictedWinnerRank === 1) wins++;
          if (topPickActualRank !== undefined && topPickActualRank <= 3) top3++;
          winnerRaceCount++;
          winnerMRRSum += 1 / predictedWinnerRank;
          if (predictedWinnerRank <= 3) winnerTop3++;
          if (predictedWinnerRank <= 5) winnerTop5++;
        }

        if (topPickActual?.finalOdds != null && Number.isFinite(topPickActual.finalOdds) && topPickActual.finalOdds > 0) {
          roiBets++;
          roiProfit += topPickActual.position === 1 ? topPickActual.finalOdds - 1 : -1;
        }
      } catch {
        // Keep model comparison robust: one malformed race should not stop the report.
      }
    }
  }

  return {
    name: model.name,
    winRate: races > 0 ? wins / races : 0,
    top3Rate: races > 0 ? top3 / races : 0,
    winnerTop3Rate: winnerRaceCount > 0 ? winnerTop3 / winnerRaceCount : 0,
    winnerTop5Rate: winnerRaceCount > 0 ? winnerTop5 / winnerRaceCount : 0,
    winnerMRR: winnerRaceCount > 0 ? winnerMRRSum / winnerRaceCount : 0,
    rankMAE: horses > 0 ? rankError / horses : 999,
    roi: roiBets > 0 ? roiProfit / roiBets : null,
    roiBets,
    races,
    horses,
  };
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function fmtRoi(value: number | null, bets: number): string {
  if (value == null) return 'n/a';
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%/${bets}`;
}

function bestByWin(results: ModelMetrics[]): ModelMetrics | undefined {
  return [...results].sort((a, b) => b.winRate - a.winRate || a.rankMAE - b.rankMAE)[0];
}

function bestByMae(results: ModelMetrics[]): ModelMetrics | undefined {
  return [...results].sort((a, b) => a.rankMAE - b.rankMAE || b.winRate - a.winRate)[0];
}

function bestByRoi(results: ModelMetrics[]): ModelMetrics | undefined {
  return [...results]
    .filter(r => r.roi != null)
    .sort((a, b) => (b.roi ?? -Infinity) - (a.roi ?? -Infinity) || b.winRate - a.winRate)[0];
}

function bestByWinnerTop5(results: ModelMetrics[]): ModelMetrics | undefined {
  return [...results].sort((a, b) =>
    b.winnerTop5Rate - a.winnerTop5Rate
    || b.winnerMRR - a.winnerMRR
    || b.winRate - a.winRate
  )[0];
}

function bestByPickTop3(results: ModelMetrics[]): ModelMetrics | undefined {
  return [...results].sort((a, b) =>
    b.top3Rate - a.top3Rate
    || b.winRate - a.winRate
    || b.winnerMRR - a.winnerMRR
  )[0];
}

function promotionCandidate(results: ModelMetrics[]): ModelMetrics | undefined {
  const current = results.find(r => r.name === 'DEFAULT');
  if (!current) return undefined;

  return [...results]
    .filter(r => r.name !== 'DEFAULT')
    .filter(r => r.winRate > current.winRate)
    .filter(r => r.winnerMRR >= current.winnerMRR)
    .filter(r => r.winnerTop3Rate >= current.winnerTop3Rate - 0.01)
    .filter(r => r.winnerTop5Rate >= current.winnerTop5Rate - 0.03)
    .filter(r => r.top3Rate >= current.top3Rate - 0.03)
    .sort((a, b) =>
      b.winRate - a.winRate
      || b.winnerMRR - a.winnerMRR
      || b.winnerTop5Rate - a.winnerTop5Rate
    )[0];
}

function writeReport(datasetPath: string, range: string, results: ModelMetrics[]): string {
  const report = {
    evaluatedAt: new Date().toISOString(),
    dataset: datasetPath,
    dateRange: range,
    modelCount: results.length,
    rule: 'No model becomes default unless it beats DEFAULT on a named holdout set.',
    best: {
      byWinPick: bestByWin(results),
      byPromotionGates: promotionCandidate(results),
      byWinnerTop5: bestByWinnerTop5(results),
      byPickTop3: bestByPickTop3(results),
      byRankMAE: bestByMae(results),
      byROI: bestByRoi(results),
    },
    results,
  };
  const outPath = path.join('reports', 'model-evaluation-latest.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  return outPath;
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('Usage: npm run evaluate:models -- [holdout.json] [--ratings-dataset training.json]');
    console.log('');
    console.log('Compares DEFAULT and every configured weight preset on a named holdout dataset.');
    console.log('Outputs win-pick %, top-pick top-3 %, winner top-3/top-5 %, MRR, rank MAE, ROI when final odds are available, race count, and date range.');
    return;
  }

  const args = process.argv.slice(2);
  const ratingsDatasetIndex = args.indexOf('--ratings-dataset');
  const ratingsDatasetPath = ratingsDatasetIndex >= 0 ? args[ratingsDatasetIndex + 1] : undefined;
  if (ratingsDatasetIndex >= 0 && !ratingsDatasetPath) {
    throw new Error('--ratings-dataset requires a path');
  }
  const positional = args.filter((arg, index) =>
    arg !== '--ratings-dataset'
      && (ratingsDatasetIndex < 0 || index !== ratingsDatasetIndex + 1)
  );
  const datasetPath = positional[0] || 'calibration-dataset-6mo.json';
  const dataset = loadDataset(datasetPath, { primeDriverRatings: false });
  if (ratingsDatasetPath) {
    const ratingsDataset = loadDataset(ratingsDatasetPath, { primeDriverRatings: false });
    primeDriverRatings(ratingsDataset);
  } else {
    primeDriverRatings([]);
    console.warn('Driver empirical ratings disabled: pass --ratings-dataset with training-only data to enable them.');
  }
  const range = dateRange(dataset);
  const candidates = uniqueModels();
  const results: ModelMetrics[] = [];

  console.log(`Model holdout comparison`);
  console.log(`Dataset: ${datasetPath}`);
  console.log(`Date range: ${range}`);
  console.log(`Models: ${candidates.length}`);
  console.log('');

  for (const candidate of candidates) {
    results.push(await evaluateModel(dataset, candidate));
  }

  results.sort((a, b) => {
    if (a.name === 'DEFAULT') return -1;
    if (b.name === 'DEFAULT') return 1;
    return b.winRate - a.winRate || a.rankMAE - b.rankMAE;
  });

  console.log(
    `${'Model'.padEnd(42)} ${'Win'.padStart(7)} ${'PickT3'.padStart(7)} ${'WinT3'.padStart(7)} ${'WinT5'.padStart(7)} ${'MRR'.padStart(7)} ${'MAE'.padStart(7)} ${'ROI/bets'.padStart(12)} ${'Races'.padStart(7)}`
  );
  console.log('-'.repeat(118));
  for (const r of results) {
    const name = r.name.length > 41 ? `${r.name.slice(0, 38)}...` : r.name;
    console.log(
      `${name.padEnd(42)} ${pct(r.winRate).padStart(7)} ${pct(r.top3Rate).padStart(7)} ${pct(r.winnerTop3Rate).padStart(7)} ${pct(r.winnerTop5Rate).padStart(7)} ${r.winnerMRR.toFixed(3).padStart(7)} ${r.rankMAE.toFixed(3).padStart(7)} ${fmtRoi(r.roi, r.roiBets).padStart(12)} ${String(r.races).padStart(7)}`
    );
  }

  const gated = promotionCandidate(results);
  const coverage = bestByWinnerTop5(results);
  const place = bestByPickTop3(results);
  console.log('');
  console.log(`Promotion gates: ${gated ? gated.name : 'none passed'}`);
  if (coverage) {
    console.log(`Coverage leader: ${coverage.name}  WinT5=${pct(coverage.winnerTop5Rate)}  Win=${pct(coverage.winRate)}  MRR=${coverage.winnerMRR.toFixed(3)}`);
  }
  if (place) {
    console.log(`Place leader: ${place.name}  PickT3=${pct(place.top3Rate)}  Win=${pct(place.winRate)}`);
  }

  const reportPath = writeReport(datasetPath, range, results);

  console.log('');
  console.log(`Saved report: ${reportPath}`);
  console.log('Rule: no model becomes default unless it beats DEFAULT on a named holdout set.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
