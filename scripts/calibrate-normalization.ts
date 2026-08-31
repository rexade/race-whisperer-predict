/**
 * Calibrate the 2140m-auto conversion against measured bias.
 *
 * The conversion corrects distance and start method and nothing else. Measured
 * with within-horse residuals — each start against that horse's own mean, which
 * cancels horse quality and leaves only conversion error — four faults show:
 *
 *   volte term (3000m)   ~0.98s   flat 1.0 s/km, but a standing start costs a
 *                                 fixed TOTAL time, so as a km-time it must
 *                                 fall with distance
 *   track                ~0.63s   absent; Swedish tracks differ in circumference,
 *                                 banking and surface
 *   season               ~0.42s   absent; September fastest, January slowest
 *   distance rates        0.13s   3.2/2.0 slightly too aggressive
 *
 * All four land in the base time before a single weight applies, so every weight
 * in the model was fitted to compensate for a biased foundation.
 *
 * PROTOCOL: everything is fitted on the TRAIN split. The holdout is scored once
 * at the end. Fitting ~30 constants and evaluating on the same races would look
 * good and mean nothing.
 *
 * These corrections do NOT cancel out of a ranking. They apply to each horse's
 * OWN history, and two horses in the same race have different histories — one
 * campaigned at a fast track in summer, another at a slow track in winter.
 *
 * Usage: npx tsx scripts/calibrate-normalization.ts [--out data/norm-constants.json]
 */
import * as fs from 'fs';
import { chronologicalHoldout } from '../src/services/calibration/datasetSplits';
import { loadDataset } from './cli-common';

const arg = (f: string) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : undefined; };

const REF = 2140, TOL = 50;
const toSec = (t: any) => t.minutes * 60 + t.seconds + (t.tenths ?? 0) / 10;
const med = (a: number[]) => a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0;

interface Start { sec: number; d: number; volte: boolean; track: string; month: number; horse: number }

function extract(dataset: any[]): Start[] {
  const out: Start[] = [];
  let hid = 0;
  for (const day of dataset) {
    for (const race of day.races) {
      for (const rk of race.rawKmTimes ?? []) {
        const all = (rk.allTimes ?? []).filter((t: any) =>
          t?.valid !== false && t?.originalTime && Number.isFinite(t.distance) && t?.raceId && t?.raceDate);
        if (all.length < 3) continue;               // need a within-horse mean
        const h = hid++;
        for (const t of all) {
          out.push({
            sec: toSec(t.originalTime),
            d: t.distance,
            volte: String(t.startMethod ?? '').toLowerCase().includes('volte'),
            track: String(t.raceId).split('_')[1] ?? '?',
            month: new Date(t.raceDate).getUTCMonth() + 1,
            horse: h,
          });
        }
      }
    }
  }
  return out;
}

interface Constants {
  shorterRate: number;
  longerRate: number;
  /** Volte cost as TOTAL race seconds; per-km term is volteTotalS / (D/1000). */
  volteTotalS: number;
  track: Record<string, number>;
  month: Record<string, number>;
}

const normalize = (s: Start, c: Constants): number => {
  let v = s.sec;
  if (Math.abs(s.d - REF) > TOL) {
    v += s.d < REF ? (REF - s.d) / 1000 * c.shorterRate : -((s.d - REF) / 1000 * c.longerRate);
  }
  if (s.volte) v -= c.volteTotalS / (s.d / 1000);
  v -= c.track[s.track] ?? 0;
  v -= c.month[String(s.month)] ?? 0;
  return v;
};

/** Within-horse residuals: each start against its own horse's mean. */
function residuals(starts: Start[], c: Constants): number[] {
  const norm = starts.map(s => normalize(s, c));
  const sum = new Map<number, { t: number; n: number }>();
  starts.forEach((s, i) => {
    const e = sum.get(s.horse) ?? { t: 0, n: 0 };
    e.t += norm[i]; e.n++; sum.set(s.horse, e);
  });
  return starts.map((s, i) => norm[i] - sum.get(s.horse)!.t / sum.get(s.horse)!.n);
}

/** Median |residual| across groups — the quantity every correction is reducing. */
function groupSpread(starts: Start[], c: Constants, keyOf: (s: Start) => string, minN: number): number {
  const res = residuals(starts, c);
  const g = new Map<string, number[]>();
  starts.forEach((s, i) => {
    const k = keyOf(s);
    (g.get(k) ?? g.set(k, []).get(k)!).push(res[i]);
  });
  const meds = [...g.values()].filter(v => v.length >= minN).map(med);
  return meds.length ? Math.max(...meds) - Math.min(...meds) : 0;
}

function fitOffsets(starts: Start[], c: Constants, keyOf: (s: Start) => string, minN: number): Record<string, number> {
  const res = residuals(starts, c);
  const g = new Map<string, number[]>();
  starts.forEach((s, i) => {
    const k = keyOf(s);
    (g.get(k) ?? g.set(k, []).get(k)!).push(res[i]);
  });
  const out: Record<string, number> = {};
  for (const [k, v] of g) if (v.length >= minN) out[k] = med(v);
  return out;
}

function main() {
  const ds = loadDataset(arg('--dataset') ?? 'calibration-dataset-5y.json', { primeDriverRatings: false });
  const { train, holdout } = chronologicalHoldout(ds, 0.2, 6);
  const trainStarts = extract(train);
  const holdStarts = extract(holdout);
  console.log(`\ntrain starts ${trainStarts.length}, holdout starts ${holdStarts.length}`);

  const c: Constants = { shorterRate: 3.2, longerRate: 2.0, volteTotalS: 2.14, track: {}, month: {} };
  const distKey = (s: Start) => `${s.volte ? 'v' : 'a'}${Math.round(s.d / 500) * 500}`;

  console.log(`\nstart: dist-band spread ${groupSpread(trainStarts, c, distKey, 300).toFixed(3)}s`);

  // Rates and the volte total are structural; grid them together on TRAIN.
  let best = { s: 3.2, l: 2.0, v: 2.14, spread: Infinity };
  for (const s of [2.8, 3.0, 3.2]) {
    for (const l of [1.4, 1.6, 1.8, 2.0]) {
      for (const v of [1.4, 1.8, 2.14, 2.6, 3.2, 4.0]) {
        const cand = { ...c, shorterRate: s, longerRate: l, volteTotalS: v };
        const sp = groupSpread(trainStarts, cand, distKey, 300);
        if (sp < best.spread) best = { s, l, v, spread: sp };
      }
    }
  }
  c.shorterRate = best.s; c.longerRate = best.l; c.volteTotalS = best.v;
  console.log(`fitted rates: shorter ${best.s}, longer ${best.l}, volteTotal ${best.v}s  -> spread ${best.spread.toFixed(3)}s`);

  // Then track, then season. ONE pass only: track and month offsets interact
  // through the within-horse mean, and a second pass measurably diverged
  // (train track spread 0.280s -> 0.490s) rather than converging.
  for (let pass = 1; pass <= 1; pass++) {
    c.track = fitOffsets(trainStarts, c, s => s.track, 800);
    c.month = fitOffsets(trainStarts, c, s => String(s.month), 2000);
    console.log(`pass ${pass}: track spread ${groupSpread(trainStarts, c, s => s.track, 800).toFixed(3)}s, ` +
      `month spread ${groupSpread(trainStarts, c, s => String(s.month), 2000).toFixed(3)}s`);
  }

  console.log('\n--- HOLDOUT (never fitted) ---');
  const base: Constants = { shorterRate: 3.2, longerRate: 2.0, volteTotalS: 2.14, track: {}, month: {} };
  // volteTotalS 2.14 reproduces the shipped flat 1.0 s/km only at 2140m; use the
  // real shipped behaviour as the baseline instead.
  const shipped: Constants = { ...base, volteTotalS: 0, track: {}, month: {} };
  const shippedFlat = (s: Start) => {
    let v = s.sec;
    if (Math.abs(s.d - REF) > TOL) v += s.d < REF ? (REF - s.d) / 1000 * 3.2 : -((s.d - REF) / 1000 * 2.0);
    if (s.volte) v -= 1.0;
    return v;
  };
  const shippedRes = (() => {
    const norm = holdStarts.map(shippedFlat);
    const sum = new Map<number, { t: number; n: number }>();
    holdStarts.forEach((s, i) => { const e = sum.get(s.horse) ?? { t: 0, n: 0 }; e.t += norm[i]; e.n++; sum.set(s.horse, e); });
    return holdStarts.map((s, i) => norm[i] - sum.get(s.horse)!.t / sum.get(s.horse)!.n);
  })();
  const spreadOf = (res: number[], keyOf: (s: Start) => string, minN: number) => {
    const g = new Map<string, number[]>();
    holdStarts.forEach((s, i) => { const k = keyOf(s); (g.get(k) ?? g.set(k, []).get(k)!).push(res[i]); });
    const meds = [...g.values()].filter(v => v.length >= minN).map(med);
    return meds.length ? Math.max(...meds) - Math.min(...meds) : 0;
  };
  console.log(`shipped     dist ${spreadOf(shippedRes, distKey, 200).toFixed(3)}s  track ${spreadOf(shippedRes, s => s.track, 300).toFixed(3)}s  month ${spreadOf(shippedRes, s => String(s.month), 600).toFixed(3)}s`);
  const fittedRes = residuals(holdStarts, c);
  console.log(`calibrated  dist ${spreadOf(fittedRes, distKey, 200).toFixed(3)}s  track ${spreadOf(fittedRes, s => s.track, 300).toFixed(3)}s  month ${spreadOf(fittedRes, s => String(s.month), 600).toFixed(3)}s`);

  const out = arg('--out') ?? 'data/norm-constants.json';
  fs.writeFileSync(out, JSON.stringify(c, null, 2));
  console.log(`\nwrote ${out}`);
}

main();
