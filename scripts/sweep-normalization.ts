/**
 * Sweep the normalization constants against PREDICTION, not against bias.
 *
 * calibrate-normalization fitted these constants to minimise measured
 * conversion bias, and the result predicted worse than the biased original
 * (holdout MRR 0.5763 against 0.5818, and still worse after refitting the
 * weights). The lesson was that bias is not the objective: some of what looks
 * like conversion error is context — track and season persist into the race
 * being predicted — so removing it destroys signal.
 *
 * This optimises the thing that actually matters. Coordinate descent over the
 * constants, scored by TRAIN MRR, holdout read once at the end.
 *
 * `alpha` shrinks the track and season corrections rather than forcing
 * all-or-nothing: 0 reproduces shipped behaviour, 1 applies the calibration in
 * full, and anything between keeps part of the correction while leaving part of
 * the context intact.
 *
 * Usage: npx tsx scripts/sweep-normalization.ts
 */
import * as fs from 'fs';
import { chronologicalHoldout } from '../src/services/calibration/datasetSplits';
import { RaceResultProcessor } from '../src/components/v75/services/raceResultProcessor';
import { loadDataset, primeDriverRatings } from './cli-common';

const arg = (f: string) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : undefined; };

const REF = 2140, TOL = 50;
const toSec = (t: any) => t.minutes * 60 + t.seconds + (t.tenths ?? 0) / 10;
const toKm = (s: number) => {
  const m = Math.floor(s / 60), r = s - m * 60, sec = Math.floor(r);
  return { minutes: m, seconds: sec, tenths: Math.round((r - sec) * 10) };
};

const C = JSON.parse(fs.readFileSync('data/norm-constants.json', 'utf-8'));
const cfg = JSON.parse(fs.readFileSync(arg('--config') ?? 'data/cfg-tillagg.json', 'utf-8'));

interface Params {
  shorterRate: number;
  longerRate: number;
  /** Volte correction. 'flat' is the shipped s/km form; 'scaled' spreads a fixed total over the distance. */
  volteMode: 'flat' | 'scaled';
  volteValue: number;
  /** Shrinkage on the fitted track/season offsets. 0 = shipped, 1 = full calibration. */
  alpha: number;
}

const SHIPPED: Params = { shorterRate: 3.2, longerRate: 2.0, volteMode: 'flat', volteValue: 1.0, alpha: 0 };

/** Rebuild every base time in `days` under `p`. Mutates, so callers reload. */
function rebuild(days: any[], p: Params): void {
  for (const day of days) {
    for (const race of day.races) {
      for (const rk of race.rawKmTimes ?? []) {
        const all = (rk.allTimes ?? []).filter((t: any) =>
          t?.originalTime && Number.isFinite(t.distance) && t?.raceId && t?.raceDate);
        if (!all.length) continue;
        const norm = all.map((t: any) => {
          let v = toSec(t.originalTime);
          const d = t.distance;
          if (Math.abs(d - REF) > TOL) {
            v += d < REF ? (REF - d) / 1000 * p.shorterRate : -((d - REF) / 1000 * p.longerRate);
          }
          if (String(t.startMethod ?? '').toLowerCase().includes('volte')) {
            v -= p.volteMode === 'flat' ? p.volteValue : p.volteValue / (d / 1000);
          }
          if (p.alpha !== 0) {
            v -= p.alpha * (C.track[String(t.raceId).split('_')[1]] ?? 0);
            v -= p.alpha * (C.month[String(new Date(t.raceDate).getUTCMonth() + 1)] ?? 0);
          }
          return v;
        });
        const valid = all.map((t: any, i: number) => ({ t, v: norm[i] })).filter((x: any) => x.t?.valid !== false);
        const windowed = valid.some((x: any) => x.t.rawTimeWindow) && valid.filter((x: any) => x.t.rawTimeWindow === 'recent').length
          ? valid.filter((x: any) => x.t.rawTimeWindow === 'recent') : valid;
        const secs = windowed.slice(0, 3).map((x: any) => x.v).filter(Number.isFinite);
        if (!secs.length) continue;
        const b = toKm(secs.reduce((s: number, v: number) => s + v, 0) / secs.length);
        rk.rawBestTime = b;
        rk.bestTime = b;
      }
    }
  }
}

async function score(days: any[]): Promise<{ mrr: number; win: number; n: number }> {
  let wins = 0, mrr = 0, n = 0;
  for (const day of days) {
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
      if (!rank) continue;
      n++; mrr += 1 / rank; if (rank === 1) wins++;
    }
  }
  return { mrr: mrr / n, win: wins / n, n };
}

const path = arg('--dataset') ?? 'calibration-dataset-5y.json';

async function evaluate(p: Params, which: 'train' | 'holdout') {
  const ds = loadDataset(path, { primeDriverRatings: false });
  const { train, holdout } = chronologicalHoldout(ds, 0.2, 6);
  primeDriverRatings(train);
  const target = which === 'train' ? train : holdout;
  rebuild(target, p);
  return score(target);
}

async function main() {
  let best = { ...SHIPPED };
  let bestMrr = (await evaluate(best, 'train')).mrr;
  console.log(`\nshipped constants — train MRR ${bestMrr.toFixed(4)}\n`);
  console.log('candidate                                    train MRR');
  console.log('-'.repeat(58));

  const axes: Array<[string, Params[]]> = [
    ['longerRate', [1.2, 1.6, 2.0, 2.4, 2.8].map(v => ({ ...best, longerRate: v }))],
    ['shorterRate', [2.4, 2.8, 3.2, 3.6, 4.0].map(v => ({ ...best, shorterRate: v }))],
    ['volte flat', [0.0, 0.5, 1.0, 1.5, 2.0].map(v => ({ ...best, volteMode: 'flat' as const, volteValue: v }))],
    ['volte scaled', [1.0, 1.4, 2.14, 3.0].map(v => ({ ...best, volteMode: 'scaled' as const, volteValue: v }))],
    ['alpha (track+season)', [0, 0.15, 0.3, 0.5, 0.75, 1.0].map(v => ({ ...best, alpha: v }))],
  ];

  for (const [label, candidates] of axes) {
    for (const cand of candidates) {
      // Re-seed each candidate from the running best so the descent compounds.
      const merged: Params = { ...best, ...cand, };
      const r = await evaluate(merged, 'train');
      const mark = r.mrr > bestMrr ? ' *' : '';
      const desc = label === 'alpha (track+season)' ? `alpha=${merged.alpha}`
        : label === 'volte flat' ? `volte flat ${merged.volteValue}`
        : label === 'volte scaled' ? `volte scaled ${merged.volteValue}`
        : label === 'longerRate' ? `longerRate ${merged.longerRate}`
        : `shorterRate ${merged.shorterRate}`;
      console.log(`  ${desc.padEnd(40)} ${r.mrr.toFixed(4)}${mark}`);
      if (r.mrr > bestMrr) { bestMrr = r.mrr; best = merged; }
    }
  }

  console.log('-'.repeat(58));
  console.log(`\nbest on TRAIN: shorter ${best.shorterRate}, longer ${best.longerRate}, ` +
    `volte ${best.volteMode} ${best.volteValue}, alpha ${best.alpha}  (train MRR ${bestMrr.toFixed(4)})`);

  const hShip = await evaluate(SHIPPED, 'holdout');
  const hBest = await evaluate(best, 'holdout');
  console.log(`\n--- HOLDOUT (read once) ---`);
  console.log(`  shipped   MRR ${hShip.mrr.toFixed(4)}  win ${(hShip.win * 100).toFixed(1)}%  (n=${hShip.n})`);
  console.log(`  swept     MRR ${hBest.mrr.toFixed(4)}  win ${(hBest.win * 100).toFixed(1)}%  (n=${hBest.n})`);
  const d = hBest.mrr - hShip.mrr;
  console.log(`  ${d >= 0 ? '+' : ''}${d.toFixed(4)} MRR — ${d > 0 ? 'improvement' : 'no improvement'}`);
}

main().catch(e => { console.error(e); process.exit(1); });
