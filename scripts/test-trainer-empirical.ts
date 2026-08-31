/**
 * Does an empirical trainer rate add anything the model does not already have?
 *
 * driverEmpirical is the strongest horse feature in this repo, and it works
 * because ATG's career driver stat mixes every race format while a rate
 * computed from our own V75/V85 results does not. The same argument applies to
 * trainers, and nothing has ever tested it -- extractHorseData read a path ATG
 * does not populate, so no dataset here carried a trainer at all until the
 * lookup was fixed.
 *
 * ATG's own trainer statistics cannot answer this: it publishes only the two
 * most recent years, so a 2021 race has no contemporaneous trainer record and
 * borrowing the 2026 one would be lookahead. Trainer NAMES are present for
 * every start in every year, which is all an empirical rate needs.
 *
 * This measures before building. Rather than wiring a new weight through types,
 * presets and the UI on spec, it adds the trainer term on top of the existing
 * model's predicted time and sweeps its weight:
 *
 *   score_i = modelTime_i + w * trainerAdjustment(rate_i)
 *
 * w = 0 is the current model exactly, so any w that beats it on the holdout is
 * the feature earning its place. Ratings are computed from the TRAINING split
 * only -- a rate that has seen the holdout's results would be predicting races
 * it already knows the answer to.
 *
 * Usage:
 *   npx tsx scripts/test-trainer-empirical.ts [--dataset calibration-dataset-5y-trainer.json]
 */
import * as fs from 'fs';
import { chronologicalHoldout } from '../src/services/calibration/datasetSplits';
import { RaceResultProcessor } from '../src/components/v75/services/raceResultProcessor';
import { calculateDriverAdjustment } from '../src/services/modernKm/driverCalculators';
import { loadDataset, primeDriverRatings } from './cli-common';

const arg = (f: string) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : undefined; };

// Same prior as driverRatingService: a trainer with three starts should land
// near the base rate rather than at 0% or 100%.
const PRIOR_RATE = 0.12;
const PRIOR_STARTS = 10;
/**
 * Trainers below this many starts are left unrated rather than smoothed toward
 * the prior. With a median of 2 starts, most of the field is prior-dominated:
 * including them adds a near-constant to almost every horse and buries whatever
 * the well-sampled trainers know. calculateDriverAdjustment is centred on the
 * same 12% baseline the prior uses, so an unrated trainer scores 0 — the prior
 * and "no adjustment" coincide, and thin trainers cost nothing rather than
 * biasing their horses.
 */
const MIN_STARTS = Number(arg('--min-starts') ?? 0);

const trainerName = (h: any): string =>
  `${(h?.trainer?.firstName ?? '').trim()} ${(h?.trainer?.lastName ?? '').trim()}`.trim().toLowerCase();

function computeTrainerRatings(dataset: any[]): Map<string, number> {
  const counts = new Map<string, { wins: number; starts: number }>();
  for (const day of dataset) {
    for (const race of day.races) {
      for (const h of race.raceData?.horses ?? []) {
        const name = trainerName(h);
        if (!name || !h.horseKey) continue;
        const actual = race.actualResults.get(h.horseKey);
        if (!actual) continue;
        const e = counts.get(name) ?? { wins: 0, starts: 0 };
        e.starts++;
        if (actual.position === 1) e.wins++;
        counts.set(name, e);
      }
    }
  }
  const out = new Map<string, number>();
  const priorWins = PRIOR_RATE * PRIOR_STARTS;
  for (const [name, c] of counts) {
    if (c.starts < MIN_STARTS) continue;
    out.set(name, (c.wins + priorWins) / (c.starts + PRIOR_STARTS));
  }
  return out;
}

interface Race { times: number[]; trainerAdj: number[]; winnerIdx: number }

async function prepare(dataset: any[], weights: any, curves: any, ratings: Map<string, number>): Promise<Race[]> {
  const out: Race[] = [];
  for (const day of dataset) {
    for (const race of day.races) {
      const res = await RaceResultProcessor.processRaceResult(race.raceData, race.rawKmTimes, weights, undefined, curves);
      if (!res.analysisComplete) continue;
      const real = res.horses.filter((h: any) => !h.modernNormalizedResult?.isEstimated && h.modernNormalizedResult?.modernNormalizedTime);
      if (real.length < 4) continue;
      const key = (h: any) => h.horseKey ?? String(h.horseId);
      const byKey = new Map((race.raceData?.horses ?? []).map((h: any) => [h.horseKey, h]));

      let winnerIdx = -1;
      real.forEach((h: any, i: number) => { if (race.actualResults.get(key(h))?.position === 1) winnerIdx = i; });
      if (winnerIdx < 0) continue;

      const times = real.map((h: any) => {
        const t = h.modernNormalizedResult.modernNormalizedTime;
        return t.minutes * 60 + t.seconds + t.tenths / 10;
      });
      // An unrated trainer gets 0, which is the same neutral the driver path
      // uses: calculateDriverAdjustment is centred on the 12% baseline, so the
      // prior and "no adjustment" coincide rather than biasing unrated runners.
      const trainerAdj = real.map((h: any) => {
        const src = byKey.get(key(h));
        const rate = src ? ratings.get(trainerName(src)) : undefined;
        return rate === undefined ? 0 : calculateDriverAdjustment(rate);
      });
      out.push({ times, trainerAdj, winnerIdx });
    }
  }
  return out;
}

function score(races: Race[], w: number) {
  let wins = 0, mrr = 0, top3 = 0;
  for (const r of races) {
    const s = r.times.map((t, i) => t + w * r.trainerAdj[i]);
    const order = s.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
    const rank = order.findIndex(o => o.i === r.winnerIdx) + 1;
    if (rank === 1) wins++;
    if (rank <= 3) top3++;
    mrr += 1 / rank;
  }
  return { win: wins / races.length, top3: top3 / races.length, mrr: mrr / races.length, n: races.length };
}

async function main() {
  const cfg = JSON.parse(fs.readFileSync(arg('--config') ?? 'data/cfg-ht-with-de.json', 'utf-8'));
  const ds = loadDataset(arg('--dataset') ?? 'calibration-dataset-5y-trainer.json', { primeDriverRatings: false });
  const { train, holdout } = chronologicalHoldout(ds, 0.2, 6);
  primeDriverRatings(train);

  const ratings = computeTrainerRatings(train);
  const starts = new Map<string, number>();
  for (const day of train) for (const race of day.races) for (const h of race.raceData?.horses ?? []) {
    const n = trainerName(h); if (n) starts.set(n, (starts.get(n) ?? 0) + 1);
  }
  const counts = [...starts.values()].sort((a, b) => b - a);
  console.log(`\ntrainers rated: ${ratings.size}`);
  console.log(`starts per trainer: median ${counts[Math.floor(counts.length / 2)] ?? 0}, max ${counts[0] ?? 0}, with >=20 starts: ${counts.filter(c => c >= 20).length}`);

  const trainR = await prepare(train, cfg.weights, cfg.postPositionCurves, ratings);
  const holdR = await prepare(holdout, cfg.weights, cfg.postPositionCurves, ratings);
  console.log(`train ${trainR.length} races / holdout ${holdR.length} races\n`);

  const weights = [0, 0.25, 0.5, 1.0, 1.5, 2.0, 3.0, 5.0];
  console.log('w        TRAIN win%    MRR      |   HOLDOUT win%    top3     MRR');
  console.log('---------------------------------------------------------------------');
  let best = { w: 0, mrr: -1 };
  for (const w of weights) {
    const t = score(trainR, w);
    if (t.mrr > best.mrr) best = { w, mrr: t.mrr };
    const h = score(holdR, w);
    console.log(`${w.toFixed(2).padStart(5)}    ${(t.win * 100).toFixed(1).padStart(8)}%  ${t.mrr.toFixed(4)}   |   ${(h.win * 100).toFixed(1).padStart(9)}%  ${(h.top3 * 100).toFixed(1).padStart(6)}%  ${h.mrr.toFixed(4)}${w === 0 ? '  <- current model' : ''}`);
  }

  const chosen = score(holdR, best.w);
  const base = score(holdR, 0);
  console.log('---------------------------------------------------------------------');
  console.log(`\nw chosen on TRAIN: ${best.w}`);
  console.log(`  holdout with trainer: win ${(chosen.win * 100).toFixed(1)}%  MRR ${chosen.mrr.toFixed(4)}`);
  console.log(`  holdout without     : win ${(base.win * 100).toFixed(1)}%  MRR ${base.mrr.toFixed(4)}`);
  const d = (chosen.win - base.win) * 100;
  console.log(`  trainerEmpirical adds: ${d >= 0 ? '+' : ''}${d.toFixed(1)}pp win, ${(chosen.mrr - base.mrr >= 0 ? '+' : '')}${(chosen.mrr - base.mrr).toFixed(4)} MRR  (${Math.round(d / 100 * base.n)} races of ${base.n})`);
}

main().catch(e => { console.error(e); process.exit(1); });
