/**
 * Does the market already price the features the model uses?
 *
 * A feature only creates edge if the crowd misprices it. For each post position
 * this compares the ACTUAL win rate against the market's normalised implied
 * probability (1/odds, renormalised across the field so takeout is removed).
 * If the two track each other, the market has already priced that feature and
 * a model term for it adds nothing incremental.
 */
import { chronologicalHoldout } from '../src/services/calibration/datasetSplits';
import { loadDataset } from './cli-common';

function argValue(f: string) { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : undefined; }

async function main() {
  const dataset = loadDataset(argValue('--dataset') ?? 'calibration-dataset-full.json', { primeDriverRatings: false });

  // pos -> { starts, wins, impliedSum }
  const byPos = new Map<number, { starts: number; wins: number; implied: number }>();
  let fieldSizeRecip = 0, races = 0;

  for (const d of dataset) {
    for (const race of d.races) {
      const horses: any[] = race.raceData?.horses ?? [];
      const priced = horses.filter(h => typeof h.liveOdds === "number" && h.liveOdds > 0 && h.horseKey);
      if (priced.length < 2) continue;
      // Normalise 1/odds across the field -> removes takeout, gives probabilities summing to 1
      const raw = priced.map(h => 1 / h.liveOdds);
      const total = raw.reduce((s, v) => s + v, 0);
      if (!(total > 0)) continue;

      races++; fieldSizeRecip += 1 / priced.length;

      priced.forEach((h, i) => {
        const pos = h.postPosition;
        if (!Number.isFinite(pos) || pos < 1 || pos > 15) return;
        const actual = race.actualResults.get(h.horseKey);
        if (!actual) return;
        const e = byPos.get(pos) ?? { starts: 0, wins: 0, implied: 0 };
        e.starts++;
        e.implied += raw[i] / total;
        if (actual.position === 1) e.wins++;
        byPos.set(pos, e);
      });
    }
  }

  console.log(`\nRaces with odds: ${races}   mean random top-pick agreement: ${(fieldSizeRecip / races * 100).toFixed(1)}%\n`);
  console.log('pos  starts   actual win%   market implied%    diff');
  console.log('---------------------------------------------------');
  for (const pos of [...byPos.keys()].sort((a, b) => a - b)) {
    const e = byPos.get(pos)!;
    if (e.starts < 30) continue;
    const act = e.wins / e.starts * 100;
    const imp = e.implied / e.starts * 100;
    const diff = act - imp;
    const flag = Math.abs(diff) >= 3 ? (diff > 0 ? '  << underpriced' : '  << overpriced') : '';
    console.log(`${String(pos).padStart(3)}  ${String(e.starts).padStart(6)}   ${act.toFixed(1).padStart(10)}%   ${imp.toFixed(1).padStart(14)}%   ${(diff >= 0 ? '+' : '') + diff.toFixed(1)}pp${flag}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
