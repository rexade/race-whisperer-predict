/**
 * Shadow test: does a budget-aware ticket engine beat today's spreadSuggestion?
 *
 * Two layers, kept strictly apart. The PREDICTION layer is untouched - the
 * model ranks horses exactly as it does in the app, and nothing here may
 * reorder it. The TICKET layer answers a question the model was never asked:
 * given 500 rows, where does covering one more horse buy the most hit
 * probability?
 *
 * Coupon hit rate is ~5%, so comparing two engines by counting hits would need
 * ~1400 cards per arm - roughly 27 years at one coupon a week. Instead the
 * comparison is on EXPECTED hit probability from calibrated per-horse
 * probabilities, which uses all 604 holdout legs. That is only trustworthy if
 * the calibration itself is honest, so this prints the calibration check first
 * and the comparison second. Read them in that order.
 *
 * V85 is 0.50 kr per row: 250 kr = 500 rows.
 *
 *   npx tsx scripts/shadow-ticket.ts [--budget 250] [--spread 3]
 */
import * as fs from 'fs';
import { chronologicalHoldout } from '../src/services/calibration/datasetSplits';
import { RaceResultProcessor } from '../src/components/v75/services/raceResultProcessor';
import { loadDataset, primeDriverRatings } from './cli-common';
import { sortByPrediction, rankingScoreSeconds, spreadSuggestion } from '../src/components/v75/utils/raceRanking';
import { horseResultKey } from '../src/components/v75/utils/horseResultIdentity';
import { calibrateWinProbabilities, allocateBudget } from '../src/services/analysis/ticketBudget';

const arg = (f: string) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : undefined; };
const ROW_COST = 0.5;

interface Leg { date: string; seconds: number[]; winnerIndex: number; spreadN: number }

async function collect(days: any[], cfg: any): Promise<Leg[]> {
  const out: Leg[] = [];
  for (const day of days) {
    for (const race of day.races) {
      const res = await RaceResultProcessor.processRaceResult(
        race.raceData, race.rawKmTimes, cfg.weights, undefined, cfg.postPositionCurves);
      if (!res.analysisComplete) continue;
      const sorted = sortByPrediction(res.horses as any);
      if (sorted.length < 3) continue;
      let winner: string | undefined;
      for (const [k, v] of race.actualResults) if (v.position === 1) { winner = k; break; }
      if (!winner) continue;
      const keys = sorted.map(h => horseResultKey(h as any));
      const winnerIndex = keys.indexOf(winner);
      if (winnerIndex < 0) continue;
      out.push({
        date: day.date,
        seconds: sorted.map(h => rankingScoreSeconds(h as any)),
        winnerIndex,
        spreadN: spreadSuggestion(sorted as any).horses.length,
      });
    }
  }
  return out;
}

/**
 * Fit the temperature on training legs only, by maximising the log-likelihood
 * of who actually won. One parameter over ~2000 races cannot overfit.
 *
 * A second (shape) parameter was tried and cut: 1.8 of extra training
 * log-likelihood, zero change in actual coupon outcomes, and it pushed the
 * predicted hit rate to 4.41% against a realised 3.1%. Simpler is also better
 * calibrated here.
 */
function fitTemperature(legs: Leg[]): number {
  const ll = (t: number) => legs.reduce((s, l) =>
    s + Math.log(Math.max(calibrateWinProbabilities(l.seconds, t)[l.winnerIndex], 1e-12)), 0);
  let lo = 0.05, hi = 20;
  for (let i = 0; i < 200; i++) {
    const a = lo + (hi - lo) / 3, b = hi - (hi - lo) / 3;
    if (ll(a) < ll(b)) lo = a; else hi = b;
  }
  return (lo + hi) / 2;
}

async function main() {
  const budgetKr = Number(arg('--budget') ?? 250);
  const maxRows = Math.floor(budgetKr / ROW_COST);
  const cfg = JSON.parse(fs.readFileSync('data/cfg-current.json', 'utf-8'));
  const ds = loadDataset('calibration-dataset-5y.json', { primeDriverRatings: false });
  const { train, holdout } = chronologicalHoldout(ds, 0.2, 6);
  primeDriverRatings(train);

  const CACHE = 'data/shadow-legs-cache.json';
  let trainLegs: Leg[], holdLegs: Leg[];
  if (fs.existsSync(CACHE) && !process.argv.includes('--refresh')) {
    ({ trainLegs, holdLegs } = JSON.parse(fs.readFileSync(CACHE, 'utf-8')));
    console.log('using cached legs (--refresh to rebuild)');
  } else {
    trainLegs = await collect(train, cfg);
    holdLegs = await collect(holdout, cfg);
    fs.writeFileSync(CACHE, JSON.stringify({ trainLegs, holdLegs }));
  }
  const temperature = fitTemperature(trainLegs);
  console.log(`
temperature fitted on ${trainLegs.length} training legs: ${temperature.toFixed(3)}`);
  console.log(`  (couponPlan.ts hard-codes this; if they differ, the app is not building the coupon measured here)`);

  // Isotonic correction on the CUMULATIVE coverage - that is what the allocator
  // consumes, and calibrating it directly is what makes its arithmetic honest.
  // Fitted on training legs only.
  // NO post-hoc calibration. Three attempts were measured and all failed:
  // a shape parameter barely moved (0.92), a global isotonic map was swamped by
  // the many near-full-coverage points, and a per-depth isotonic INFLATED the
  // estimate (expected 5.66%, realised 0/77 against 3/77 without it).
  //
  // The reason is in the train/holdout split: the top band is 5.4pp
  // over-confident in training and 11.9pp out of sample, while the overall
  // top-pick rate transfers perfectly (38.8% vs 39.1%). Only the confident end
  // degrades, so most of the error is distribution shift and nothing fitted on
  // past data can reach it. Read the top band as roughly 10pp optimistic.
  const legProbs = (l: Leg) => calibrateWinProbabilities(l.seconds, temperature);

  // --- calibration check: does a stated probability mean what it says? ------
  const probs = holdLegs.map(l => ({ p: legProbs(l)[0], won: l.winnerIndex === 0 ? 1 : 0 }));
  probs.sort((a, b) => a.p - b.p);
  console.log(`\nCALIBRATION of the top pick, ${probs.length} holdout legs`);
  console.log('  predicted band     legs   predicted   actual');
  const k = 5, sz = Math.floor(probs.length / k);
  for (let i = 0; i < k; i++) {
    const seg = i === k - 1 ? probs.slice(i * sz) : probs.slice(i * sz, (i + 1) * sz);
    const pred = seg.reduce((s, r) => s + r.p, 0) / seg.length;
    const act = seg.reduce((s, r) => s + r.won, 0) / seg.length;
    console.log(`  ${(100*seg[0].p).toFixed(0).padStart(3)}-${(100*seg[seg.length-1].p).toFixed(0).padEnd(3)}%        ${String(seg.length).padStart(4)}     ${(100*pred).toFixed(1).padStart(5)}%   ${(100*act).toFixed(1).padStart(5)}%`);
  }

  // --- coupon comparison ----------------------------------------------------
  const byDate = new Map<string, Leg[]>();
  for (const l of holdLegs) { const g = byDate.get(l.date); if (g) g.push(l); else byDate.set(l.date, [l]); }
  // Exactly eight legs: V85 and V86. Including seven-leg V75 cards mixes an
  // easier product into the average and flatters every strategy equally, which
  // makes the numbers useless for deciding an actual V85 coupon.
  const cards = [...byDate.values()].filter(v => v.length === 8);

  const score = (pick: (legs: Leg[]) => number[]) => {
    let expHit = 0, rows = 0;
    const tiers: Record<number, number> = { 8: 0, 7: 0, 6: 0 };
    for (const legs of cards) {
      const n = pick(legs);
      let e = 1, r = 1, correct = 0;
      legs.forEach((l, i) => {
        const p = legProbs(l);
        e *= p.slice(0, n[i]).reduce((a, b) => a + b, 0);
        r *= n[i];
        if (l.winnerIndex < n[i]) correct++;
      });
      expHit += e; rows += r;
      // V85 pays on 8, 7 and 6 correct. A card with more legs than 8 is scored
      // on how many of ITS legs were covered, relative to its own length.
      const missed = legs.length - correct;
      if (missed === 0) tiers[8]++;
      else if (missed === 1) tiers[7]++;
      else if (missed === 2) tiers[6]++;
    }
    return { expHit: expHit / cards.length, rows: rows / cards.length, tiers };
  };

  const uniform = (k: number) => (legs: Leg[]) => legs.map(l => Math.min(k, l.seconds.length));
  const byGap = (legs: Leg[]) => {
    // Rank-only heuristic: cover more where the gap to the next horse is small.
    // No calibration, no probabilities - just the model's order and margins.
    const counts = legs.map(() => 1);
    let rows = 1;
    for (;;) {
      let best = -1, bestGap = Infinity;
      legs.forEach((l, i) => {
        if (counts[i] >= l.seconds.length) return;
        if ((rows / counts[i]) * (counts[i] + 1) > maxRows) return;
        const g = l.seconds[counts[i]] - l.seconds[counts[i] - 1];
        if (g < bestGap) { bestGap = g; best = i; }
      });
      if (best < 0) return counts;
      rows = (rows / counts[best]) * (counts[best] + 1);
      counts[best]++;
    }
  };

  const strategies: Array<[string, (legs: Leg[]) => number[]]> = [
    ['spreadSuggestion (today)', legs => legs.map(l => l.spreadN)],
    ['uniform 2 per leg', uniform(2)],
    ['uniform 3 per leg', uniform(3)],
    ['smallest-gap first', byGap],
    ['budget allocator', legs => allocateBudget(legs.map(legProbs), maxRows)],
  ];

  console.log(`
STRATEGY COMPARISON — ${cards.length} holdout cards, budget ${budgetKr} kr = ${maxRows} rows`);
  console.log('  strategy                  exp.full   rows/card    cost   all right   1 wrong   2 wrong');
  for (const [name, fn] of strategies) {
    const s = score(fn);
    console.log(`  ${name.padEnd(25)} ${(100*s.expHit).toFixed(2).padStart(6)}%   ${s.rows.toFixed(0).padStart(9)}   ${(s.rows*ROW_COST).toFixed(0).padStart(4)} kr   ${String(s.tiers[8]).padStart(9)}   ${String(s.tiers[7]).padStart(7)}   ${String(s.tiers[6]).padStart(7)}`);
  }
  console.log(`
  Only rows/card near ${maxRows} are comparable; the others spend a different budget.`);
  console.log(`  Actual hits at ~5% are noise on ${cards.length} cards - read expected hit.`);
}

main().catch(e => { console.error(e); process.exit(1); });
