/**
 * Audit every normalization weight against the win-odds market.
 *
 * Two experiments are reported on the same races:
 *   1. Single signal: raw-time model plus one weight.
 *   2. Leave one out: full model with one configured weight removed.
 *
 * The market baseline is odds-only. Spelprocent is never used as a fallback.
 *
 * Usage:
 *   npx tsx scripts/weight-audit.ts --dataset calibration-dataset-5y.json
 *   npx tsx scripts/weight-audit.ts --from 2025-11-01 --to 2026-05-11
 *   npx tsx scripts/weight-audit.ts --from 2026-07-05 --config data/cfg-V41.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { RaceResultProcessor } from '../src/components/v75/services/raceResultProcessor';
import { chronologicalHoldout } from '../src/services/calibration/datasetSplits';
import { CalibrationDataset } from '../src/services/calibration/historicalCalibrationService';
import { horseKeyFromRaceHorse } from '../src/services/horseIdentity';
import { PostPositionCurves } from '../src/services/modernKm';
import { DEFAULT_WEIGHTS, NormalizationWeights } from '../src/services/modernKm/types';
import { loadDataset, primeDriverRatings } from './cli-common';

const WEIGHT_KEYS: readonly (keyof NormalizationWeights)[] = [
  'postPosition',
  'shoeType',
  'sulkyType',
  'driverPerformance',
  'driverForm',
  'driverEmpirical',
  'trackFamiliarity',
  'form',
  'distanceAdjustment',
  'raceDistanceAdjustment',
  'volteStartDistancePenalty',
  'startPoints',
  'placePercentage',
  'horseWinPercentage',
  'earningsPerStart',
  'gallopRisk',
  'layoffPenalty',
  'ageFactor',
  'genderAdjustment',
  'consistencyFactor',
  'trainerPerformance',
  'oddsHistorical',
  'oddsLive',
  'betDistribution',
  'shoeChange',
];

interface ModelConfig {
  label: string;
  weights: NormalizationWeights;
  postPositionCurves?: PostPositionCurves;
}

interface RaceObservation {
  raceId: string;
  modelRank: number;
  marketRank: number;
}

interface AuditMetrics {
  races: number;
  modelWins: number;
  marketWins: number;
  modelWinRate: number;
  marketWinRate: number;
  modelMRR: number;
  marketMRR: number;
  winDelta: number;
  winDelta95: [number, number];
  modelOnlyWins: number;
  marketOnlyWins: number;
}

interface WeightAuditRow {
  weight: keyof NormalizationWeights;
  configuredValue: number;
  singleValue: number;
  single: AuditMetrics;
  without?: AuditMetrics;
  removalWinDelta?: number;
  removalMrrDelta?: number;
}

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function zeroWeights(): NormalizationWeights {
  return Object.fromEntries(WEIGHT_KEYS.map(key => [key, 0])) as unknown as NormalizationWeights;
}

function loadConfig(configPath?: string): ModelConfig {
  if (!configPath) {
    return { label: 'DEFAULT_WEIGHTS', weights: DEFAULT_WEIGHTS };
  }

  const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  return {
    label: raw.label ?? path.basename(configPath),
    weights: raw.weights ?? raw,
    postPositionCurves: raw.postPositionCurves,
  };
}

function selectEvaluationWindow(
  dataset: CalibrationDataset,
  from?: string,
  to?: string,
  holdoutFraction = 0.2
): { train: CalibrationDataset; evaluation: CalibrationDataset; mode: string } {
  const sorted = [...dataset].sort((a, b) => a.date.localeCompare(b.date));
  if (from || to) {
    const evaluation = sorted.filter(day => (!from || day.date >= from) && (!to || day.date <= to));
    const firstEvaluationDate = evaluation[0]?.date;
    const train = firstEvaluationDate
      ? sorted.filter(day => day.date < firstEvaluationDate)
      : [];
    return { train, evaluation, mode: `date window ${from ?? 'start'} to ${to ?? 'end'}` };
  }

  const split = chronologicalHoldout(sorted, holdoutFraction, 6);
  return {
    train: split.train,
    evaluation: split.holdout,
    mode: `latest ${(holdoutFraction * 100).toFixed(0)}% chronological holdout`,
  };
}

function pairedMetrics(observations: RaceObservation[]): AuditMetrics {
  const races = observations.length;
  const modelWins = observations.filter(row => row.modelRank === 1).length;
  const marketWins = observations.filter(row => row.marketRank === 1).length;
  const modelOnlyWins = observations.filter(row => row.modelRank === 1 && row.marketRank !== 1).length;
  const marketOnlyWins = observations.filter(row => row.modelRank !== 1 && row.marketRank === 1).length;
  const modelMRR = races
    ? observations.reduce((sum, row) => sum + 1 / row.modelRank, 0) / races
    : 0;
  const marketMRR = races
    ? observations.reduce((sum, row) => sum + 1 / row.marketRank, 0) / races
    : 0;
  const differences = observations.map(row => Number(row.modelRank === 1) - Number(row.marketRank === 1));
  const winDelta = races ? differences.reduce((sum, value) => sum + value, 0) / races : 0;
  const variance = races > 1
    ? differences.reduce((sum, value) => sum + (value - winDelta) ** 2, 0) / (races - 1)
    : 0;
  const margin = races > 1 ? 1.96 * Math.sqrt(variance / races) : 0;

  return {
    races,
    modelWins,
    marketWins,
    modelWinRate: races ? modelWins / races : 0,
    marketWinRate: races ? marketWins / races : 0,
    modelMRR,
    marketMRR,
    winDelta,
    winDelta95: [winDelta - margin, winDelta + margin],
    modelOnlyWins,
    marketOnlyWins,
  };
}

async function evaluate(
  dataset: CalibrationDataset,
  weights: NormalizationWeights,
  curves?: PostPositionCurves
): Promise<AuditMetrics> {
  const observations: RaceObservation[] = [];

  for (const dateData of dataset) {
    for (const race of dateData.races) {
      try {
        const result = await RaceResultProcessor.processRaceResult(
          race.raceData,
          race.rawKmTimes,
          weights,
          undefined,
          curves
        );
        if (!result.analysisComplete || result.horses.length < 2) continue;

        const key = (horse: (typeof result.horses)[number]) =>
          horseKeyFromRaceHorse(race.raceId, horse);
        let winnerKey: string | undefined;
        for (const [actualKey, actual] of race.actualResults) {
          if (actual.position === 1) {
            winnerKey = actualKey;
            break;
          }
        }
        if (!winnerKey) continue;

        const modelKeys = result.horses.map(key);
        const modelRank = modelKeys.indexOf(winnerKey) + 1;
        if (modelRank < 1) continue;

        const oddsByKey = new Map<string, number>();
        for (const horse of race.raceData.horses ?? []) {
          const odds = horse.liveOdds;
          if (typeof odds === 'number' && Number.isFinite(odds) && odds > 0) {
            oddsByKey.set(horseKeyFromRaceHorse(race.raceId, horse), odds);
          }
        }
        if (!modelKeys.every(horseKey => oddsByKey.has(horseKey))) continue;

        const marketKeys = [...modelKeys].sort((a, b) => oddsByKey.get(a)! - oddsByKey.get(b)!);
        const marketRank = marketKeys.indexOf(winnerKey) + 1;
        if (marketRank < 1) continue;

        observations.push({ raceId: race.raceId, modelRank, marketRank });
      } catch {
        // A malformed race must not terminate the complete audit.
      }
    }
  }

  return pairedMetrics(observations);
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function signedPp(value: number): string {
  const points = value * 100;
  return `${points >= 0 ? '+' : ''}${points.toFixed(1)}pp`;
}

function comparison(metrics: AuditMetrics): string {
  if (metrics.winDelta95[1] < 0) return 'below';
  if (metrics.winDelta95[0] > 0) return 'above';
  return 'unclear';
}

async function main(): Promise<void> {
  const datasetPath = argValue('--dataset') ?? 'calibration-dataset-5y.json';
  const from = argValue('--from');
  const to = argValue('--to');
  const holdoutFraction = Number(argValue('--holdout') ?? 0.2);
  if (!(holdoutFraction > 0 && holdoutFraction < 1)) {
    throw new Error('--holdout must be between 0 and 1');
  }

  const config = loadConfig(argValue('--config'));
  const dataset = loadDataset(datasetPath, { primeDriverRatings: false });
  const window = selectEvaluationWindow(dataset, from, to, holdoutFraction);
  if (window.evaluation.length === 0) throw new Error(`No dates found for ${window.mode}`);
  primeDriverRatings(window.train);

  const firstDate = window.evaluation[0].date;
  const lastDate = window.evaluation[window.evaluation.length - 1].date;
  const raceCount = window.evaluation.reduce((sum, day) => sum + day.races.length, 0);
  console.log(`\nWeight audit: ${config.label}`);
  console.log(`Window: ${firstDate} to ${lastDate} (${window.evaluation.length} dates, ${raceCount} races)`);
  console.log('Market: complete Vinnare odds only; spelprocent fallback disabled');
  console.log('Scoring: production ranking, including fallback-estimated horses\n');

  const rawTime = await evaluate(window.evaluation, zeroWeights(), config.postPositionCurves);
  const full = await evaluate(window.evaluation, config.weights, config.postPositionCurves);
  const fundamentalsWeights = {
    ...config.weights,
    oddsHistorical: 0,
    oddsLive: 0,
    betDistribution: 0,
  };
  const fundamentals = await evaluate(
    window.evaluation,
    fundamentalsWeights,
    config.postPositionCurves
  );
  console.log(`ODDS MARKET  win=${pct(full.marketWinRate)} (${full.marketWins}/${full.races})  MRR=${full.marketMRR.toFixed(3)}`);
  console.log(`RAW TIME     win=${pct(rawTime.modelWinRate)}  delta=${signedPp(rawTime.winDelta)}  MRR=${rawTime.modelMRR.toFixed(3)}  paired=${rawTime.modelOnlyWins}-${rawTime.marketOnlyWins}  ${comparison(rawTime)}`);
  console.log(`FUNDAMENTALS win=${pct(fundamentals.modelWinRate)}  delta=${signedPp(fundamentals.winDelta)}  MRR=${fundamentals.modelMRR.toFixed(3)}  paired=${fundamentals.modelOnlyWins}-${fundamentals.marketOnlyWins}  ${comparison(fundamentals)}`);
  console.log(`FULL MODEL   win=${pct(full.modelWinRate)}  delta=${signedPp(full.winDelta)}  MRR=${full.modelMRR.toFixed(3)}  paired=${full.modelOnlyWins}-${full.marketOnlyWins}  ${comparison(full)}\n`);

  const rows: WeightAuditRow[] = [];
  for (const weight of WEIGHT_KEYS) {
    const configuredValue = config.weights[weight] ?? 0;
    const singleValue = configuredValue !== 0 ? configuredValue : 1;
    const singleWeights = { ...zeroWeights(), [weight]: singleValue };
    const single = await evaluate(window.evaluation, singleWeights, config.postPositionCurves);

    let without: AuditMetrics | undefined;
    let removalWinDelta: number | undefined;
    let removalMrrDelta: number | undefined;
    if (configuredValue !== 0) {
      without = await evaluate(
        window.evaluation,
        { ...config.weights, [weight]: 0 },
        config.postPositionCurves
      );
      removalWinDelta = without.modelWinRate - full.modelWinRate;
      removalMrrDelta = without.modelMRR - full.modelMRR;
    }

    rows.push({
      weight,
      configuredValue,
      singleValue,
      single,
      without,
      removalWinDelta,
      removalMrrDelta,
    });
  }

  console.log('SINGLE SIGNAL: raw-time model plus only this weight');
  console.log('weight                       cfg  probe    win   vs odds       95% CI       MRR   paired   result');
  console.log('-'.repeat(106));
  for (const row of rows) {
    const [low, high] = row.single.winDelta95;
    console.log(
      `${String(row.weight).padEnd(28)} ${row.configuredValue.toFixed(3).padStart(5)}  ${row.singleValue.toFixed(3).padStart(5)}  ` +
      `${pct(row.single.modelWinRate).padStart(6)}  ${signedPp(row.single.winDelta).padStart(8)}  ` +
      `${`${signedPp(low)}..${signedPp(high)}`.padStart(19)}  ${row.single.modelMRR.toFixed(3)}  ` +
      `${`${row.single.modelOnlyWins}-${row.single.marketOnlyWins}`.padStart(7)}   ${comparison(row.single)}`
    );
  }

  console.log('\nLEAVE ONE OUT: change after removing this weight from the full model');
  console.log('weight                       cfg   without win   change vs full   MRR change   interpretation');
  console.log('-'.repeat(100));
  for (const row of rows) {
    if (!row.without || row.removalWinDelta === undefined || row.removalMrrDelta === undefined) {
      console.log(`${String(row.weight).padEnd(28)} ${row.configuredValue.toFixed(3).padStart(5)}       inactive`);
      continue;
    }
    const interpretation = row.removalWinDelta > 0
      ? 'removal improved sample wins'
      : row.removalWinDelta < 0
        ? 'removal reduced sample wins'
        : row.removalMrrDelta > 0
          ? 'removal improved sample MRR'
          : row.removalMrrDelta < 0
            ? 'removal reduced sample MRR'
            : 'no observed effect';
    console.log(
      `${String(row.weight).padEnd(28)} ${row.configuredValue.toFixed(3).padStart(5)}  ` +
      `${pct(row.without.modelWinRate).padStart(12)}  ${signedPp(row.removalWinDelta).padStart(15)}  ` +
      `${(row.removalMrrDelta >= 0 ? '+' : '') + row.removalMrrDelta.toFixed(3).padStart(10)}   ${interpretation}`
    );
  }

  const report = {
    generatedAt: new Date().toISOString(),
    dataset: path.resolve(datasetPath),
    config: config.label,
    mode: window.mode,
    evaluation: { from: firstDate, to: lastDate, dates: window.evaluation.length, races: raceCount },
    methodology: {
      market: 'complete liveOdds fields only; lower odds ranks first',
      comparison: 'paired on identical races and horse fields',
      singleSignal: 'zero-weight raw-time model plus one configured weight; inactive weights are probed at 1.0',
      leaveOneOut: 'full configured model with one active weight set to zero',
      interval: 'normal 95% interval for paired win-rate differences',
    },
    market: { winRate: full.marketWinRate, mrr: full.marketMRR, wins: full.marketWins, races: full.races },
    rawTime,
    fundamentals,
    full,
    weights: rows,
  };
  fs.mkdirSync('reports', { recursive: true });
  const reportPath = path.join('reports', `weight-audit-${firstDate}_${lastDate}.json`);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nReport: ${path.resolve(reportPath)}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
