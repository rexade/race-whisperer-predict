/**
 * Pool value: is any horse systematically underbet relative to its chance?
 *
 * In a pari-mutuel pool the payout is split among winning tickets, so what a
 * horse COSTS you is its share of the pool (spelprocent), while what it is
 * WORTH is its probability of winning. Those are different numbers set by
 * different things: odds track win probability, spelprocent tracks how people
 * build tickets. Where they diverge there is value that requires out-predicting
 * nobody -- you are exploiting ticket construction, not opinion.
 *
 *   value ratio = p_odds / p_spel   (both normalised across the field)
 *
 * A ratio above 1 means the crowd is putting less of the pool on this horse
 * than its price implies it deserves. The test is whether that ratio actually
 * sorts horses by realised return: within each bucket we report the actual win
 * rate against the mean pool share paid for it. Return multiple = win rate /
 * pool share; above 1.0 is money, since each unit of pool share is what a unit
 * stake buys.
 *
 * Both metrics come from the market, so nothing here depends on the model
 * being any good. This is descriptive analysis of market structure across the
 * whole dataset rather than a fitted strategy, so treat it as a hypothesis
 * generator: a bucket that looks profitable still needs confirming out of sample.
 */
import { loadDataset } from './cli-common';

function argValue(f: string) { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : undefined; }

interface Row { pOdds: number; pSpel: number; ratio: number; won: boolean }

async function main() {
  const dataset = loadDataset(argValue('--dataset') ?? 'calibration-dataset-full.json', { primeDriverRatings: false });

  const rows: Row[] = [];
  let racesUsed = 0, racesSkipped = 0;

  for (const day of dataset) {
    for (const race of day.races) {
      const horses: any[] = race.raceData?.horses ?? [];
      // Both signals must be present for every horse, otherwise the two
      // normalisations describe different fields and the ratio is meaningless.
      const usable = horses.filter(h =>
        h.horseKey &&
        typeof h.liveOdds === 'number' && h.liveOdds > 0 &&
        typeof h.betDistribution === 'number' && h.betDistribution > 0);
      if (usable.length < 4 || usable.length !== horses.length) { racesSkipped++; continue; }

      const oddsRaw = usable.map(h => 1 / h.liveOdds);
      const spelRaw = usable.map(h => h.betDistribution);
      const oddsSum = oddsRaw.reduce((s, v) => s + v, 0);
      const spelSum = spelRaw.reduce((s, v) => s + v, 0);
      if (!(oddsSum > 0) || !(spelSum > 0)) { racesSkipped++; continue; }

      racesUsed++;
      usable.forEach((h, i) => {
        const pOdds = oddsRaw[i] / oddsSum;
        const pSpel = spelRaw[i] / spelSum;
        const actual = race.actualResults.get(h.horseKey);
        rows.push({ pOdds, pSpel, ratio: pOdds / pSpel, won: actual?.position === 1 });
      });
    }
  }

  console.log(`\nraces used ${racesUsed}, skipped ${racesSkipped} (incomplete market data), horses ${rows.length}\n`);

  const buckets: Array<[string, (r: Row) => boolean]> = [
    ['ratio < 0.6   (heavily overbet)', r => r.ratio < 0.6],
    ['0.6 - 0.8     (overbet)',         r => r.ratio >= 0.6 && r.ratio < 0.8],
    ['0.8 - 1.0     (slightly over)',   r => r.ratio >= 0.8 && r.ratio < 1.0],
    ['1.0 - 1.25    (slightly under)',  r => r.ratio >= 1.0 && r.ratio < 1.25],
    ['1.25 - 1.6    (underbet)',        r => r.ratio >= 1.25 && r.ratio < 1.6],
    ['ratio >= 1.6  (heavily under)',   r => r.ratio >= 1.6],
  ];

  console.log('bucket                              n     win%   mean pool%   return multiple');
  console.log('--------------------------------------------------------------------------------');
  for (const [label, pred] of buckets) {
    const b = rows.filter(pred);
    if (b.length === 0) { console.log(`${label.padEnd(34)} ${String(0).padStart(5)}       -            -         -`); continue; }
    const win = b.filter(r => r.won).length / b.length;
    const pool = b.reduce((s, r) => s + r.pSpel, 0) / b.length;
    const mult = pool > 0 ? win / pool : NaN;
    console.log(`${label.padEnd(34)} ${String(b.length).padStart(5)}   ${(win * 100).toFixed(1).padStart(6)}%   ${(pool * 100).toFixed(2).padStart(9)}%   ${mult.toFixed(3).padStart(9)}`);
  }

  // Sanity anchor: across the whole sample the pool shares sum to the wins, so
  // an unbiased market gives a multiple near 1.0 everywhere. Deviations are the
  // finding; this line shows the baseline they are deviations from.
  const winAll = rows.filter(r => r.won).length / rows.length;
  const poolAll = rows.reduce((s, r) => s + r.pSpel, 0) / rows.length;
  console.log('--------------------------------------------------------------------------------');
  console.log(`${'ALL'.padEnd(34)} ${String(rows.length).padStart(5)}   ${(winAll * 100).toFixed(1).padStart(6)}%   ${(poolAll * 100).toFixed(2).padStart(9)}%   ${(winAll / poolAll).toFixed(3).padStart(9)}`);
}

main().catch(e => { console.error(e); process.exit(1); });
