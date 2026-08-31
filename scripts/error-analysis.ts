/**
 * When the model is wrong, what is it wrong ABOUT?
 *
 * An aggregate MRR says how often the pick lands but nothing about the shape of
 * the misses, and the shape is what tells you whether anything is fixable. A
 * model that mostly loses to its own rank 2 is well calibrated and simply
 * facing a close race; one that loses to horses it buried at rank 9 is missing
 * a signal those horses share.
 *
 * Three questions, in order of usefulness:
 *   1. Where does the winner actually rank when the top pick loses? Near-misses
 *      are noise; deep misses are a missing feature.
 *   2. What did our own pick do — did it run second, or nowhere? A pick that
 *      finishes nowhere is a different failure from one narrowly beaten.
 *   3. How do the winners we MISS differ from the ones we CATCH? A profile gap
 *      is a candidate feature; no gap means the losses are irreducible.
 *
 * Usage: npx tsx scripts/error-analysis.ts [--config data/cfg-tillagg.json]
 */
import * as fs from 'fs';
import { chronologicalHoldout } from '../src/services/calibration/datasetSplits';
import { RaceResultProcessor } from '../src/components/v75/services/raceResultProcessor';
import { loadDataset, primeDriverRatings } from './cli-common';

const arg = (f: string) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : undefined; };

interface Case {
  hit: boolean;
  winnerRank: number;          // where WE ranked the actual winner
  ourPickFinish: number | null; // where OUR pick actually finished
  gapToWinner: number;          // predicted-time gap, our pick -> actual winner
  winnerOdds: number | null;
  winnerSpel: number | null;
  winnerTillagg: number;
  winnerPost: number;
  fieldSize: number;
}

const med = (a: number[]) => a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : NaN;
const mean = (a: number[]) => a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN;

async function main() {
  const cfg = JSON.parse(fs.readFileSync(arg('--config') ?? 'data/cfg-tillagg.json', 'utf-8'));
  const ds = loadDataset(arg('--dataset') ?? 'calibration-dataset-5y.json', { primeDriverRatings: false });
  const { train, holdout } = chronologicalHoldout(ds, 0.2, 6);
  primeDriverRatings(train);

  const cases: Case[] = [];
  for (const day of holdout) {
    for (const race of day.races) {
      const res = await RaceResultProcessor.processRaceResult(race.raceData, race.rawKmTimes, cfg.weights, undefined, cfg.postPositionCurves);
      if (!res.analysisComplete) continue;
      const real = res.horses.filter((h: any) => !h.modernNormalizedResult?.isEstimated && h.modernNormalizedResult?.modernNormalizedTime);
      if (real.length < 4) continue;
      const key = (h: any) => h.horseKey ?? String(h.horseId);
      const secs = (h: any) => {
        const t = h.modernNormalizedResult.modernNormalizedTime;
        return t.minutes * 60 + t.seconds + t.tenths / 10;
      };

      let winner: string | undefined;
      for (const [k, v] of race.actualResults) if (v.position === 1) { winner = k; break; }
      if (!winner) continue;
      const winnerRank = real.findIndex((h: any) => key(h) === winner) + 1;
      if (winnerRank === 0) continue;

      const src = new Map((race.raceData?.horses ?? []).map((h: any) => [h.horseKey, h]));
      const w = src.get(winner) as any;
      const raceDist = race.raceData?.distance ?? 0;

      cases.push({
        hit: winnerRank === 1,
        winnerRank,
        ourPickFinish: race.actualResults.get(key(real[0]))?.position ?? null,
        gapToWinner: secs(real[winnerRank - 1]) - secs(real[0]),
        winnerOdds: typeof w?.liveOdds === 'number' ? w.liveOdds : null,
        winnerSpel: typeof w?.betDistribution === 'number' ? w.betDistribution : null,
        winnerTillagg: Number.isFinite(w?.distance) && raceDist ? w.distance - raceDist : 0,
        winnerPost: w?.postPosition ?? 0,
        fieldSize: real.length,
      });
    }
  }

  const hits = cases.filter(c => c.hit);
  const miss = cases.filter(c => !c.hit);
  console.log(`\nholdout races ${cases.length} — hit ${hits.length} (${(hits.length / cases.length * 100).toFixed(1)}%), missed ${miss.length}\n`);

  console.log('1. WHERE THE WINNER ACTUALLY RANKED, when we missed');
  const buckets: Array<[string, (c: Case) => boolean]> = [
    ['rank 2      (near miss)', c => c.winnerRank === 2],
    ['rank 3', c => c.winnerRank === 3],
    ['rank 4-5', c => c.winnerRank >= 4 && c.winnerRank <= 5],
    ['rank 6-8', c => c.winnerRank >= 6 && c.winnerRank <= 8],
    ['rank 9+     (deep miss)', c => c.winnerRank >= 9],
  ];
  for (const [label, pred] of buckets) {
    const b = miss.filter(pred);
    console.log(`   ${label.padEnd(26)} ${String(b.length).padStart(3)}  ${(b.length / miss.length * 100).toFixed(1).padStart(5)}% of misses`);
  }

  console.log('\n2. WHAT OUR OWN PICK DID, when it lost');
  const fin = miss.map(c => c.ourPickFinish).filter((v): v is number => v !== null && v > 0);
  for (const [label, pred] of [
    ['finished 2nd', (v: number) => v === 2],
    ['finished 3rd', (v: number) => v === 3],
    ['finished 4-5', (v: number) => v >= 4 && v <= 5],
    ['finished 6+ or nowhere', (v: number) => v >= 6],
  ] as Array<[string, (v: number) => boolean]>) {
    const b = fin.filter(pred);
    console.log(`   ${label.padEnd(26)} ${String(b.length).padStart(3)}  ${(b.length / fin.length * 100).toFixed(1).padStart(5)}%`);
  }

  console.log('\n3. WINNERS WE MISS vs WINNERS WE CATCH');
  const col = (label: string, f: (c: Case) => number | null) => {
    const h = hits.map(f).filter((v): v is number => v !== null);
    const m = miss.map(f).filter((v): v is number => v !== null);
    console.log(`   ${label.padEnd(26)} caught median ${med(h).toFixed(2).padStart(7)}   missed median ${med(m).toFixed(2).padStart(7)}`);
  };
  col('winner odds', c => c.winnerOdds);
  col('winner spelprocent %', c => c.winnerSpel);
  col('winner post position', c => c.winnerPost);
  col('winner tillagg (m)', c => c.winnerTillagg);
  col('field size', c => c.fieldSize);
  console.log(`   ${'predicted gap to winner'.padEnd(26)} missed mean ${mean(miss.map(c => c.gapToWinner)).toFixed(2)}s, median ${med(miss.map(c => c.gapToWinner)).toFixed(2)}s`);

  const deep = miss.filter(c => c.winnerRank >= 9);
  if (deep.length) {
    console.log(`\n   deep misses (rank 9+): ${deep.length} races — winner median odds ${med(deep.map(c => c.winnerOdds).filter((v): v is number => v !== null)).toFixed(1)}, median spel ${med(deep.map(c => c.winnerSpel).filter((v): v is number => v !== null)).toFixed(1)}%`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
