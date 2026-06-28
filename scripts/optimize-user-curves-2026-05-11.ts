import { loadDataset } from './cli-common';
import { evaluateWeights } from '../src/services/calibration/historicalCalibrationService';
import { NormalizationWeights } from '../src/services/modernKm/types';
import { PostPositionCurves } from '../src/services/modernKm';
import { weights as userWeights, postPositionCurves as userCurves } from './reproduce-user-weights-2026-05-11';

type Metrics = Awaited<ReturnType<typeof evaluateWeights>>;
type Axis =
  | { kind: 'legacy'; startType: 'auto' | 'volte'; pos: number }
  | { kind: 'bucketed'; startType: 'auto' | 'volte'; bucket: 'short' | 'medium' | 'long'; pos: number };

function cloneCurves(c: PostPositionCurves): PostPositionCurves {
  return JSON.parse(JSON.stringify(c));
}

function clampCurve(value: number): number {
  return Math.max(-1.5, Math.min(1.5, value));
}

function metricLine(label: string, m: Metrics): string {
  return `${label} Win=${(m.winAccuracy * 100).toFixed(2)}% MRR=${m.winnerMRR.toFixed(6)} WTop3=${(m.winnerTop3Accuracy * 100).toFixed(2)}% WTop5=${(m.winnerTop5Accuracy * 100).toFixed(2)}% PickT3=${(m.topPickAccuracy * 100).toFixed(2)}%`;
}

function better(candidate: Metrics, best: Metrics): boolean {
  return candidate.winAccuracy > best.winAccuracy + 1e-12
    || (Math.abs(candidate.winAccuracy - best.winAccuracy) < 1e-12 && candidate.winnerMRR > best.winnerMRR + 1e-12)
    || (
      Math.abs(candidate.winAccuracy - best.winAccuracy) < 1e-12
      && Math.abs(candidate.winnerMRR - best.winnerMRR) < 1e-12
      && candidate.topPickAccuracy > best.topPickAccuracy + 1e-12
    );
}

function axes(curves: PostPositionCurves): Axis[] {
  const positions = Array.from({ length: 15 }, (_, i) => i + 1);
  const out: Axis[] = [];
  for (const startType of ['auto', 'volte'] as const) {
    for (const pos of positions) out.push({ kind: 'legacy', startType, pos });
  }
  if (curves.byDistance) {
    for (const startType of ['auto', 'volte'] as const) {
      for (const bucket of ['short', 'medium', 'long'] as const) {
        for (const pos of positions) out.push({ kind: 'bucketed', startType, bucket, pos });
      }
    }
  }
  return out;
}

function getCurve(c: PostPositionCurves, axis: Axis): number {
  return axis.kind === 'legacy'
    ? c[axis.startType][axis.pos] ?? 0
    : c.byDistance![axis.startType][axis.bucket][axis.pos] ?? 0;
}

function setCurve(c: PostPositionCurves, axis: Axis, value: number): void {
  if (axis.kind === 'legacy') c[axis.startType][axis.pos] = value;
  else c.byDistance![axis.startType][axis.bucket][axis.pos] = value;
}

function axisLabel(axis: Axis): string {
  return axis.kind === 'legacy'
    ? `${axis.startType}.${axis.pos}`
    : `${axis.startType}.${axis.bucket}.${axis.pos}`;
}

async function main() {
  const datasetPath = process.argv[2] || 'calibration-dataset-6mo_lat_5_11_3.json';
  const dataset = loadDataset(datasetPath);
  const weights: NormalizationWeights = {
    ...(userWeights as NormalizationWeights),
    raceDistanceAdjustment: 0.383235,
  };
  let bestCurves = cloneCurves(userCurves as PostPositionCurves);
  let bestMetrics = await evaluateWeights(dataset, weights, bestCurves);
  console.log(metricLine('BASE', bestMetrics));

  for (const step of [0.05, 0.025, 0.01]) {
    let improved = false;
    for (const axis of axes(bestCurves)) {
      const current = getCurve(bestCurves, axis);
      for (const dir of [step, -step]) {
        const nextValue = clampCurve(current + dir);
        if (Math.abs(nextValue - current) < 1e-12) continue;

        const nextCurves = cloneCurves(bestCurves);
        setCurve(nextCurves, axis, nextValue);
        const metrics = await evaluateWeights(dataset, weights, nextCurves);

        if (better(metrics, bestMetrics)) {
          bestCurves = nextCurves;
          bestMetrics = metrics;
          improved = true;
          console.log(metricLine(`IMPROVE step=${step} ${axisLabel(axis)} ${dir > 0 ? '+' : '-'}`, bestMetrics));
          break;
        }
      }
    }
    console.log(metricLine(`PASS step=${step}`, bestMetrics));
    if (!improved && step <= 0.01) break;
  }

  console.log('\nBEST');
  console.log(metricLine('FINAL', bestMetrics));
  console.log('weights:', JSON.stringify(weights, null, 2));
  console.log('postPositionCurves:', JSON.stringify(bestCurves, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
