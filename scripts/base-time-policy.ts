/**
 * Does the base-time policy matter more than the weights?
 *
 * Every experiment so far tuned adjustments sitting ON TOP of a single number:
 * the horse's raw km-time, produced by horseProcessing as "the mean of the most
 * recent 3 valid records in the 90-day window". That choice has never been
 * tested against alternatives, and it is fragile in an obvious way — a mean of
 * three is dragged by one gallop or one wrecked trip, and a trotting horse
 * produces those regularly.
 *
 * If the base is noisy then every weight fitted on top of it was partly fitting
 * that noise, which would explain a ceiling better than any missing feature.
 *
 * The dataset stores each historical start's normalizedTime, so the base can be
 * recomputed under a different policy and the whole ranking re-scored without
 * touching the pipeline. Policies differ ONLY in how the same samples are
 * reduced to one number.
 *
 * Usage: npx tsx scripts/base-time-policy.ts [--config data/cfg-tillagg.json]
 */
import * as fs from 'fs';
import { chronologicalHoldout } from '../src/services/calibration/datasetSplits';
import { RaceResultProcessor } from '../src/components/v75/services/raceResultProcessor';
import { loadDataset, primeDriverRatings } from './cli-common';

const arg = (f: string) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : undefined; };

const toSec = (t: any) => t.minutes * 60 + t.seconds + (t.tenths ?? 0) / 10;
const toKm = (sec: number) => {
  const minutes = Math.floor(sec / 60);
  const rest = sec - minutes * 60;
  const seconds = Math.floor(rest);
  return { minutes, seconds, tenths: Math.round((rest - seconds) * 10) };
};

const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

type Policy = { name: string; reduce: (secs: number[]) => number; take: number };

const POLICIES: Policy[] = [
  { name: 'mean of 3 (current)', take: 3, reduce: mean },
  { name: 'median of 3', take: 3, reduce: median },
  { name: 'mean of 5', take: 5, reduce: mean },
  { name: 'median of 5', take: 5, reduce: median },
  { name: 'best of 3', take: 3, reduce: a => Math.min(...a) },
  { name: 'best of 5', take: 5, reduce: a => Math.min(...a) },
  // Drop the single worst run, then average: keeps more samples than a median
  // while discarding the gallop that a mean would swallow whole.
  { name: 'drop-worst of 4', take: 4, reduce: a => a.length >= 3 ? mean([...a].sort((x, y) => x - y).slice(0, -1)) : mean(a) },
  { name: 'drop-worst of 6', take: 6, reduce: a => a.length >= 3 ? mean([...a].sort((x, y) => x - y).slice(0, -1)) : mean(a) },
];

/** Rebuild every horse's base time under `policy`, preserving the window rule. */
function applyPolicy(dataset: any[], policy: Policy): void {
  for (const day of dataset) {
    for (const race of day.races) {
      for (const rk of race.rawKmTimes ?? []) {
        const all = (rk.allTimes ?? []).filter((t: any) => t?.valid !== false && t?.normalizedTime);
        if (all.length === 0) continue;
        // Same window preference horseProcessing uses: recent records if any
        // carry the marker, otherwise everything.
        const windowed = all.some((t: any) => t.rawTimeWindow)
          ? (all.filter((t: any) => t.rawTimeWindow === 'recent').length ? all.filter((t: any) => t.rawTimeWindow === 'recent') : all)
          : all;
        const secs = windowed.slice(0, policy.take).map((t: any) => toSec(t.normalizedTime)).filter(Number.isFinite);
        if (secs.length === 0) continue;
        // horseResultProcessor reads `rawBestTime ?? bestTime`, so setting only
        // bestTime changes nothing — the whole first version of this test was a
        // no-op that reported eight identical rows.
        const recomputed = toKm(policy.reduce(secs));
        rk.rawBestTime = recomputed;
        rk.bestTime = recomputed;
      }
    }
  }
}

async function score(dataset: any[], cfg: any) {
  let wins = 0, mrrSum = 0, n = 0, top3 = 0;
  for (const day of dataset) {
    for (const race of day.races) {
      const res = await RaceResultProcessor.processRaceResult(race.raceData, race.rawKmTimes, cfg.weights, undefined, cfg.postPositionCurves);
      if (!res.analysisComplete) continue;
      const real = res.horses.filter((h: any) => !h.modernNormalizedResult?.isEstimated && h.modernNormalizedResult?.modernNormalizedTime);
      if (real.length < 4) continue;
      const key = (h: any) => h.horseKey ?? String(h.horseId);
      let winner: string | undefined;
      for (const [k, v] of race.actualResults) if (v.position === 1) { winner = k; break; }
      if (!winner) continue;
      const rank = real.findIndex((h: any) => key(h) === winner) + 1;
      if (rank === 0) continue;
      n++; mrrSum += 1 / rank;
      if (rank === 1) wins++;
      if (rank <= 3) top3++;
    }
  }
  return { n, mrr: mrrSum / n, win: wins / n, top3: top3 / n };
}

async function main() {
  const cfg = JSON.parse(fs.readFileSync(arg('--config') ?? 'data/cfg-tillagg.json', 'utf-8'));
  const path = arg('--dataset') ?? 'calibration-dataset-5y.json';

  console.log('\nRecomputing every horse base time, then re-scoring the same holdout.');
  console.log('Weights are held fixed — only the reduction of the same samples changes.\n');
  console.log('policy                      races    MRR       win%     top3%');
  console.log('-'.repeat(64));

  for (const policy of POLICIES) {
    // Reload each time: applyPolicy mutates, and a policy must not inherit the
    // base times the previous one wrote.
    const ds = loadDataset(path, { primeDriverRatings: false });
    const { train, holdout } = chronologicalHoldout(ds, 0.2, 6);
    primeDriverRatings(train);
    applyPolicy(holdout, policy);
    const r = await score(holdout, cfg);
    console.log(
      `${policy.name.padEnd(26)} ${String(r.n).padStart(4)}   ${r.mrr.toFixed(4)}   ` +
      `${(r.win * 100).toFixed(1).padStart(5)}%   ${(r.top3 * 100).toFixed(1).padStart(5)}%`
    );
  }
  console.log('-'.repeat(64));
  console.log('\nWeights were fitted against the current policy, so a policy that wins here');
  console.log('would likely win by more after a refit — and one that loses may only be');
  console.log('losing the home advantage.');
}

main().catch(e => { console.error(e); process.exit(1); });
