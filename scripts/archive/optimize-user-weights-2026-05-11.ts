import { loadDataset } from '../cli-common';
import { evaluateWeights } from '../src/services/calibration/historicalCalibrationService';
import { NormalizationWeights } from '../src/services/modernKm/types';
import { PostPositionCurves } from '../src/services/modernKm';
import { weights as userWeights, postPositionCurves as userCurves } from './reproduce-user-weights-2026-05-11';

const WEIGHT_KEYS: (keyof NormalizationWeights)[] = [
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
];

type Metrics = Awaited<ReturnType<typeof evaluateWeights>>;

function clampWeight(value: number): number {
  return Math.max(0, Math.min(7, value));
}

function metricLine(label: string, m: Metrics): string {
  return `${label} Win=${(m.winAccuracy * 100).toFixed(2)}% MRR=${m.winnerMRR.toFixed(6)} WTop3=${(m.winnerTop3Accuracy * 100).toFixed(2)}% WTop5=${(m.winnerTop5Accuracy * 100).toFixed(2)}% PickT3=${(m.topPickAccuracy * 100).toFixed(2)}%`;
}

function makeRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function better(candidate: Metrics, best: Metrics): boolean {
  return candidate.winAccuracy > best.winAccuracy + 1e-12
    || (Math.abs(candidate.winAccuracy - best.winAccuracy) < 1e-12 && candidate.winnerMRR > best.winnerMRR + 1e-12)
    || (
      Math.abs(candidate.winAccuracy - best.winAccuracy) < 1e-12
      && Math.abs(candidate.winnerMRR - best.winnerMRR) < 1e-12
      && candidate.winnerTop3Accuracy > best.winnerTop3Accuracy + 1e-12
    );
}

async function main() {
  const datasetPath = process.argv[2] || 'calibration-dataset-6mo_lat_5_11_3.json';
  const dataset = loadDataset(datasetPath);
  let bestWeights: NormalizationWeights = { ...(userWeights as NormalizationWeights) };
  const curves = userCurves as PostPositionCurves;
  let bestMetrics = await evaluateWeights(dataset, bestWeights, curves);
  console.log(metricLine('BASE', bestMetrics));

  const steps = [0.2, 0.1, 0.05, 0.025, 0.01];
  for (const step of steps) {
    let improvedThisStep = true;
    let pass = 0;
    while (improvedThisStep && pass < 4) {
      pass++;
      improvedThisStep = false;

      for (const key of WEIGHT_KEYS) {
        const current = bestWeights[key] ?? 0;
        const candidates = [
          { direction: '+', value: clampWeight(current + step) },
          { direction: '-', value: clampWeight(current - step) },
        ].filter(c => Math.abs(c.value - current) > 1e-12);

        for (const candidate of candidates) {
          const nextWeights = { ...bestWeights, [key]: candidate.value };
          const metrics = await evaluateWeights(dataset, nextWeights, curves);
          if (better(metrics, bestMetrics)) {
            bestWeights = nextWeights;
            bestMetrics = metrics;
            improvedThisStep = true;
            console.log(metricLine(`IMPROVE step=${step} ${key}${candidate.direction}`, bestMetrics));
            break;
          }
        }
      }

      console.log(metricLine(`PASS step=${step} #${pass}`, bestMetrics));
    }
  }

  const rng = makeRng(20260511);
  const randomIterations = Number(process.argv[3] ?? 250);
  for (let i = 0; i < randomIterations; i++) {
    const nextWeights = { ...bestWeights };
    const edits = 1 + Math.floor(rng() * 4);
    for (let j = 0; j < edits; j++) {
      const key = WEIGHT_KEYS[Math.floor(rng() * WEIGHT_KEYS.length)];
      const width = i < randomIterations / 2 ? 0.35 : 0.12;
      const delta = (rng() * 2 - 1) * width;
      nextWeights[key] = clampWeight((nextWeights[key] ?? 0) + delta);
    }

    const metrics = await evaluateWeights(dataset, nextWeights, curves);
    if (better(metrics, bestMetrics)) {
      bestWeights = nextWeights;
      bestMetrics = metrics;
      console.log(metricLine(`RANDOM ${i + 1}/${randomIterations}`, bestMetrics));
    }
  }

  console.log('\nBEST');
  console.log(metricLine('FINAL', bestMetrics));
  console.log('weights:', JSON.stringify(bestWeights, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
