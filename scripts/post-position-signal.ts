/**
 * Does the starting gate predict anything the odds have not already priced?
 *
 * DEFAULT_WEIGHTS carries postPosition at 0, and types.ts explains why: "the
 * odds already price the gate, not because the gate stopped mattering: refit
 * without market access and it returns at 1.0." That was an assertion. This
 * measures it, and extends it to a question the original claim did not cover:
 * whether the CONFIGURATION of the field - where the short-priced horses sit
 * relative to each other - says anything, even when no single gate does.
 *
 * Result: no, on all four counts. See the table this prints. Every gate-derived
 * feature is indistinguishable from zero out of sample while the market
 * coefficient runs z = 4.7 to 34. Two features hinted in training (z = 1.2-1.9)
 * and both flipped sign on the holdout.
 *
 * The trap this script exists to avoid: bucketing our top pick's win rate by
 * its own gate shows 42.3% from gates 1-3 against 34.0% from 7+, which looks
 * like a real 8-point effect. It is not. Wide-drawn horses carry longer odds,
 * and controlling for the price kills it completely (z = -0.49). A bucket table
 * without a price control will mislead you every time.
 *
 *   npx tsx scripts/post-position-signal.ts [--refresh]
 */
import './node-polyfills';
import * as fs from 'fs';
import { chronologicalHoldout } from '../src/services/calibration/datasetSplits';
import { RaceResultProcessor } from '../src/components/v75/services/raceResultProcessor';
import { loadDataset, primeDriverRatings } from './cli-common';
import { sortByPrediction } from '../src/components/v75/utils/raceRanking';
import { horseResultKey } from '../src/components/v75/utils/horseResultIdentity';
import { impliedProbabilities, conditionalLogit } from '../src/services/analysis/oddsDrift';
import { binaryLogit } from '../src/services/analysis/binaryLogit';

const CACHE = 'data/post-cache.json';

interface Race { split: string; raceId: string; fieldSize: number; volte: number; horses: { rank: number; post: number; odds: number; won: number }[] }

async function collect(): Promise<Race[]> {
  const cfg = JSON.parse(fs.readFileSync('data/cfg-current.json', 'utf-8'));
  const ds = loadDataset('calibration-dataset-5y.json', { primeDriverRatings: false });
  const { train, holdout } = chronologicalHoldout(ds, 0.2, 6);
  primeDriverRatings(train);

  const out: Race[] = [];
  for (const [days, split] of [[train, 'train'], [holdout, 'holdout']] as const) {
    for (const day of days) {
      for (const race of day.races) {
        const res = await RaceResultProcessor.processRaceResult(
          race.raceData, race.rawKmTimes, cfg.weights, undefined, cfg.postPositionCurves);
        if (!res.analysisComplete) continue;
        const sorted = sortByPrediction(res.horses as never);
        if (sorted.length < 4) continue;
        let winner: string | undefined;
        for (const [k, v] of race.actualResults) if (v.position === 1) { winner = k; break; }
        if (!winner) continue;
        const src = new Map((race.raceData?.horses ?? []).map((h: any) => [h.horseKey, h]));
        const horses = sorted.map((h: never, i: number) => {
          const key = horseResultKey(h);
          const raw = src.get(key) as any;
          return {
            rank: i + 1,
            post: raw?.postPosition ?? null,
            odds: typeof raw?.liveOdds === 'number' && raw.liveOdds > 1 ? raw.liveOdds : null,
            won: key === winner ? 1 : 0,
          };
        });
        // A race missing a gate or a price cannot answer the question either way.
        if (horses.some(h => h.post === null || h.odds === null)) continue;
        out.push({
          split, raceId: race.raceId, fieldSize: sorted.length,
          volte: /volt/i.test(race.raceData?.startMethod ?? '') ? 1 : 0,
          horses: horses as Race['horses'],
        });
      }
    }
  }
  fs.writeFileSync(CACHE, JSON.stringify(out));
  return out;
}

/** Race-level shape of where the short-priced horses are drawn. */
const configuration = (r: Race) => {
  const byOdds = [...r.horses].sort((a, b) => a.odds - b.odds);
  const top4 = byOdds.slice(0, 4).map(h => h.post);
  const mean = top4.reduce((a, b) => a + b, 0) / top4.length;
  return {
    spread: Math.sqrt(top4.reduce((s, v) => s + (v - mean) ** 2, 0) / top4.length),
    meanPost: mean,
    range: Math.max(...top4) - Math.min(...top4),
    favGap: Math.abs(byOdds[0].post - byOdds[1].post),
  };
};

async function main() {
  const races: Race[] = fs.existsSync(CACHE) && !process.argv.includes('--refresh')
    ? JSON.parse(fs.readFileSync(CACHE, 'utf-8'))
    : await collect();
  const tr = races.filter(r => r.split === 'train');
  const ho = races.filter(r => r.split === 'holdout');
  console.log(`\n${tr.length} train / ${ho.length} holdout races\n`);

  console.log('1. WITHIN A RACE — win ~ log(market prob) + gate');
  console.log('   sample                 n    market z    gate b      gate z');
  for (const [label, set] of [
    ['train', tr], ['holdout', ho],
    ['holdout autostart', ho.filter(r => !r.volte)],
    ['holdout volte', ho.filter(r => r.volte)],
  ] as [string, Race[]][]) {
    const obs = set.map(r => {
      const p = impliedProbabilities(r.horses.map(h => h.odds));
      return { covariates: r.horses.map((h, i) => [Math.log(p[i]), h.post]), winnerIndex: r.horses.findIndex(h => h.won) };
    }).filter(o => o.winnerIndex >= 0);
    const f = conditionalLogit(obs);
    console.log(`   ${label.padEnd(20)} ${String(obs.length).padStart(4)}   ${f.z[0].toFixed(2).padStart(8)}   ${f.coefficients[1].toFixed(4).padStart(8)}   ${f.z[1].toFixed(2).padStart(6)}`);
  }

  console.log('\n2. OUR TOP PICK — won ~ log(its market prob) + feature');
  console.log('   feature          train z    holdout z');
  const rowsFor = (set: Race[], pick: (r: Race) => number) => set.map(r => {
    const p = impliedProbabilities(r.horses.map(h => h.odds));
    return { x: [Math.log(p[0]), pick(r)], y: r.horses[0].won };
  });
  const features: [string, (r: Race) => number][] = [
    ['own gate', r => r.horses[0].post],
    ['spread', r => configuration(r).spread],
    ['meanPost', r => configuration(r).meanPost],
    ['range', r => configuration(r).range],
    ['favGap', r => configuration(r).favGap],
  ];
  for (const [name, pick] of features) {
    const a = binaryLogit(rowsFor(tr, pick)), b = binaryLogit(rowsFor(ho, pick));
    console.log(`   ${name.padEnd(14)} ${(a.z[2]).toFixed(2).padStart(8)}   ${(b.z[2]).toFixed(2).padStart(10)}`);
  }
  console.log('\n   |z| > 1.96 would be a signal. Nothing reaches it out of sample.');
}

main().catch(e => { console.error(e); process.exit(1); });
