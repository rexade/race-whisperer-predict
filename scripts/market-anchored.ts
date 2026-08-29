/**
 * Market-anchored evaluation: start from the market, add the model on top.
 *
 * Every previous run fitted the odds as one more weighted term competing with
 * the fundamentals for the same explanatory space, which makes "do my features
 * beat the market" a question you can only infer from disagreement splits. This
 * inverts it. The market is fixed at its correct value and the model enters as
 * a correction:
 *
 *   score_i = -tau * log(p_market_i)  +  alpha * (modelTime_i - mean modelTime)
 *
 * The first term is the market's own ranking expressed in seconds via the same
 * Plackett-Luce conversion the calibration service already uses (strength =
 * -seconds / tau). The second is the model's opinion, centred within the race so
 * it carries only relative information and cannot shift a race as a whole.
 *
 * alpha = 0 scores exactly the market. So any alpha that beats alpha = 0 on the
 * holdout is the model adding something the price does not already contain --
 * measured directly rather than inferred. Pass a config whose market weights are
 * zero, otherwise the odds are counted on both sides of the sum.
 *
 * Usage:
 *   npx tsx scripts/market-anchored.ts --config data/cfg-nomarket-5y-refit.json
 */
import * as fs from 'fs';
import { chronologicalHoldout } from '../src/services/calibration/datasetSplits';
import { RaceResultProcessor } from '../src/components/v75/services/raceResultProcessor';
import { loadDataset, primeDriverRatings } from './cli-common';

const TAU = 0.5; // PL_TAU_SECONDS, matching historicalCalibrationService
const arg = (f: string) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : undefined; };
const SIGNAL = (arg('--signal') ?? 'time') as 'time' | 'adjustments' | 'base';

interface Race { pMarket: number[]; modelCentred: number[]; winnerIdx: number }

/** Precompute per-race market probabilities and centred model times once. */
async function prepare(dataset: any[], weights: any, curves: any): Promise<Race[]> {
  const out: Race[] = [];
  for (const day of dataset) {
    for (const race of day.races) {
      const res = await RaceResultProcessor.processRaceResult(race.raceData, race.rawKmTimes, weights, undefined, curves);
      if (!res.analysisComplete) continue;
      const real = res.horses.filter((h: any) => !h.modernNormalizedResult?.isEstimated && h.modernNormalizedResult?.modernNormalizedTime);
      if (real.length < 4) continue;

      const key = (h: any) => h.horseKey ?? String(h.horseId);
      const oddsByKey = new Map<string, number>();
      for (const h of race.raceData?.horses ?? []) {
        if (h.horseKey && typeof h.liveOdds === 'number' && h.liveOdds > 0) oddsByKey.set(h.horseKey, h.liveOdds);
      }
      // Every scored horse needs a price, or the normalisation describes a
      // different field than the one being ranked.
      if (!real.every((h: any) => oddsByKey.has(key(h)))) continue;

      const raw = real.map((h: any) => 1 / oddsByKey.get(key(h))!);
      const sum = raw.reduce((s, v) => s + v, 0);
      if (!(sum > 0)) continue;
      const pMarket = raw.map(v => v / sum);

      // --signal decides WHAT gets added on top of the market.
      //   time        full predicted time (km-time base + every adjustment)
      //   adjustments only the adjustment total, base km-time removed
      //   base        only the km-time base, no adjustments
      // Isolating matters: the base time dominates the full number, so a single
      // feature tested via 'time' is really being judged on the speed figure it
      // rides along with rather than on its own contribution.
      const times = real.map((h: any) => {
        const r = h.modernNormalizedResult;
        const t = r.modernNormalizedTime;
        const full = t.minutes * 60 + t.seconds + t.tenths / 10;
        if (SIGNAL === 'adjustments') return r.adjustments?.total ?? 0;
        if (SIGNAL === 'base') {
          const b = r.rawTime;
          return b ? b.minutes * 60 + b.seconds + b.tenths / 10 : full;
        }
        return full;
      });
      const mean = times.reduce((s, v) => s + v, 0) / times.length;
      const modelCentred = times.map(v => v - mean);

      let winnerIdx = -1;
      real.forEach((h: any, i: number) => {
        if (race.actualResults.get(key(h))?.position === 1) winnerIdx = i;
      });
      if (winnerIdx < 0) continue;

      out.push({ pMarket, modelCentred, winnerIdx });
    }
  }
  return out;
}

function score(races: Race[], alpha: number) {
  let wins = 0, mrrSum = 0;
  for (const r of races) {
    const s = r.pMarket.map((p, i) => -TAU * Math.log(p) + alpha * r.modelCentred[i]);
    const order = s.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
    const rank = order.findIndex(o => o.i === r.winnerIdx) + 1;
    if (rank === 1) wins++;
    mrrSum += 1 / rank;
  }
  return { win: wins / races.length, mrr: mrrSum / races.length, n: races.length };
}

async function main() {
  const cfgPath = arg('--config') ?? 'data/cfg-nomarket-5y-refit.json';
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
  const active = Object.entries(cfg.weights).filter(([k, v]) => v && /odds|betDistribution/i.test(k));
  if (active.length) console.log(`WARNING: market weights still active (${active.map(([k, v]) => `${k}=${v}`).join(', ')}) — odds counted twice.\n`);

  const ds = loadDataset(arg('--dataset') ?? 'calibration-dataset-5y.json', { primeDriverRatings: false });
  const { train, holdout } = chronologicalHoldout(ds, 0.2, 6);
  primeDriverRatings(train);

  console.log(`config: ${cfg.label ?? cfgPath}\npreparing…`);
  const trainR = await prepare(train, cfg.weights, cfg.postPositionCurves);
  const holdR = await prepare(holdout, cfg.weights, cfg.postPositionCurves);
  console.log(`train ${trainR.length} races / holdout ${holdR.length} races\n`);

  const alphas = [0, 0.05, 0.1, 0.15, 0.25, 0.4, 0.6, 1.0, 1.5, 2.5];
  console.log('alpha    TRAIN win%    MRR      |   HOLDOUT win%    MRR');
  console.log('---------------------------------------------------------------');
  let best = { alpha: 0, mrr: -1 };
  for (const a of alphas) {
    const t = score(trainR, a);
    if (t.mrr > best.mrr) best = { alpha: a, mrr: t.mrr };
    const h = score(holdR, a);
    const mark = a === 0 ? '  <- pure market' : '';
    console.log(`${a.toFixed(2).padStart(5)}    ${(t.win * 100).toFixed(1).padStart(8)}%  ${t.mrr.toFixed(4)}   |   ${(h.win * 100).toFixed(1).padStart(9)}%  ${h.mrr.toFixed(4)}${mark}`);
  }

  const chosen = score(holdR, best.alpha);
  const baseline = score(holdR, 0);
  console.log('---------------------------------------------------------------');
  console.log(`\nalpha chosen on TRAIN: ${best.alpha}`);
  console.log(`  holdout with model : win ${(chosen.win * 100).toFixed(1)}%  MRR ${chosen.mrr.toFixed(4)}`);
  console.log(`  holdout pure market: win ${(baseline.win * 100).toFixed(1)}%  MRR ${baseline.mrr.toFixed(4)}`);
  const dw = (chosen.win - baseline.win) * 100;
  console.log(`  the model adds     : ${dw >= 0 ? '+' : ''}${dw.toFixed(1)}pp win, ${(chosen.mrr - baseline.mrr >= 0 ? '+' : '')}${(chosen.mrr - baseline.mrr).toFixed(4)} MRR  (${Math.round(dw / 100 * baseline.n)} races of ${baseline.n})`);
}

main().catch(e => { console.error(e); process.exit(1); });
