/**
 * A pure-market model: odds and spelprocent, nothing else.
 *
 * The usual baseline here is "back the shortest price", which uses only one of
 * the two market signals available. That is too weak a bar. The betting public
 * publishes a second, independent number -- how tickets are actually
 * constructed -- and a model built from both is the honest thing to beat before
 * claiming km-times, drivers or gates add anything.
 *
 *   score_i = -tau * [ log(p_odds_i) + beta * log(p_spel_i) ]
 *
 * beta = 0 is the odds favourite. beta > 0 blends in pool share. Both terms are
 * normalised within the race, so this contains no horse information whatsoever
 * -- only what the crowd did. beta is chosen on train and read once on holdout.
 *
 * Usage:
 *   npx tsx scripts/pure-market.ts [--dataset calibration-dataset-5y.json]
 */
import { chronologicalHoldout } from '../src/services/calibration/datasetSplits';
import { loadDataset } from './cli-common';

const arg = (f: string) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : undefined; };

interface Race { logOdds: number[]; logSpel: number[]; winnerIdx: number }

function prepare(dataset: any[]): Race[] {
  const out: Race[] = [];
  for (const day of dataset) {
    for (const race of day.races) {
      const horses: any[] = race.raceData?.horses ?? [];
      const usable = horses.filter(h =>
        h.horseKey &&
        typeof h.liveOdds === 'number' && h.liveOdds > 0 &&
        typeof h.betDistribution === 'number' && h.betDistribution > 0);
      // Partial coverage would mean the two normalisations describe different
      // fields, so a race counts only when every runner carries both signals.
      if (usable.length < 4 || usable.length !== horses.length) continue;

      const oRaw = usable.map(h => 1 / h.liveOdds);
      const sRaw = usable.map(h => h.betDistribution);
      const oSum = oRaw.reduce((s, v) => s + v, 0);
      const sSum = sRaw.reduce((s, v) => s + v, 0);
      if (!(oSum > 0) || !(sSum > 0)) continue;

      let winnerIdx = -1;
      usable.forEach((h, i) => {
        if (race.actualResults.get(h.horseKey)?.position === 1) winnerIdx = i;
      });
      if (winnerIdx < 0) continue;

      out.push({
        logOdds: oRaw.map(v => Math.log(v / oSum)),
        logSpel: sRaw.map(v => Math.log(v / sSum)),
        winnerIdx,
      });
    }
  }
  return out;
}

function score(races: Race[], beta: number) {
  let wins = 0, mrrSum = 0;
  for (const r of races) {
    const s = r.logOdds.map((lo, i) => -(lo + beta * r.logSpel[i]));
    const order = s.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
    const rank = order.findIndex(o => o.i === r.winnerIdx) + 1;
    if (rank === 1) wins++;
    mrrSum += 1 / rank;
  }
  return { win: wins / races.length, mrr: mrrSum / races.length, n: races.length };
}

async function main() {
  const ds = loadDataset(arg('--dataset') ?? 'calibration-dataset-5y.json', { primeDriverRatings: false });
  const { train, holdout } = chronologicalHoldout(ds, 0.2, 6);
  const trainR = prepare(train);
  const holdR = prepare(holdout);
  console.log(`\ntrain ${trainR.length} races / holdout ${holdR.length} races\n`);

  const betas = [0, 0.1, 0.2, 0.3, 0.5, 0.7, 1.0, 1.5, 2.0];
  console.log('beta     TRAIN win%    MRR      |   HOLDOUT win%    MRR');
  console.log('--------------------------------------------------------------');
  let best = { beta: 0, mrr: -1 };
  for (const b of betas) {
    const t = score(trainR, b);
    if (t.mrr > best.mrr) best = { beta: b, mrr: t.mrr };
    const h = score(holdR, b);
    console.log(`${b.toFixed(2).padStart(5)}    ${(t.win * 100).toFixed(1).padStart(8)}%  ${t.mrr.toFixed(4)}   |   ${(h.win * 100).toFixed(1).padStart(9)}%  ${h.mrr.toFixed(4)}${b === 0 ? '  <- odds favourite' : ''}`);
  }

  const chosen = score(holdR, best.beta);
  const oddsOnly = score(holdR, 0);
  console.log('--------------------------------------------------------------');
  console.log(`\nbeta chosen on TRAIN: ${best.beta}`);
  console.log(`  PURE MARKET (odds+spel) holdout: win ${(chosen.win * 100).toFixed(1)}%  MRR ${chosen.mrr.toFixed(4)}`);
  console.log(`  odds favourite only     holdout: win ${(oddsOnly.win * 100).toFixed(1)}%  MRR ${oddsOnly.mrr.toFixed(4)}`);
  console.log(`  adding spelprocent adds: ${(((chosen.win - oddsOnly.win) * 100) >= 0 ? '+' : '')}${((chosen.win - oddsOnly.win) * 100).toFixed(1)}pp`);
  console.log(`\n  This is the bar the full model has to clear to show that horse`);
  console.log(`  information adds anything the crowd has not already published.`);
}

main().catch(e => { console.error(e); process.exit(1); });
