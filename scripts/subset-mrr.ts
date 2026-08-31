/**
 * Where is the model already good?
 *
 * Overall holdout MRR sits at 0.583 and nothing left in the public data raises
 * it — fitting, model class and features have all been tried and all came back
 * worse. But a single average over every race hides that the model is far more
 * reliable on some legs than others, and for a V85 ticket that distinction is
 * worth more than the average is: you do not have to bet every leg the same way.
 *
 * This slices the same holdout by signals available BEFORE the race, so any
 * subset that scores well is one you can actually act on:
 *   - agreement: model's top pick equals the market favourite
 *   - margin:    predicted-time gap from rank 1 to rank 2 (the spik signal)
 *   - field size
 *
 * A subset's MRR is only meaningful next to its size — half the races at 0.65
 * is a finding, eleven races at 0.9 is not.
 *
 * Usage: npx tsx scripts/subset-mrr.ts [--dataset calibration-dataset-5y.json]
 */
import * as fs from 'fs';
import { chronologicalHoldout } from '../src/services/calibration/datasetSplits';
import { RaceResultProcessor } from '../src/components/v75/services/raceResultProcessor';
import { marketRankByKey } from '../src/services/calibration/historicalCalibrationService';
import { loadDataset, primeDriverRatings } from './cli-common';

const arg = (f: string) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : undefined; };

interface Row {
  winnerRank: number;
  marketWinnerRank: number | undefined;
  agrees: boolean;
  margin: number;
  fieldSize: number;
}

function mrr(rows: Row[], pick: (r: Row) => number | undefined): string {
  const vals = rows.map(pick).filter((v): v is number => v !== undefined);
  if (vals.length === 0) return '   n/a';
  return (vals.reduce((s, v) => s + 1 / v, 0) / vals.length).toFixed(4);
}
const winPct = (rows: Row[], pick: (r: Row) => number | undefined): string => {
  const vals = rows.map(pick).filter((v): v is number => v !== undefined);
  if (!vals.length) return '  n/a';
  return `${(vals.filter(v => v === 1).length / vals.length * 100).toFixed(1)}%`;
};

function report(label: string, rows: Row[], total: number): void {
  const share = (rows.length / total * 100).toFixed(0);
  console.log(
    `${label.padEnd(34)} ${String(rows.length).padStart(4)} (${share.padStart(2)}%)   ` +
    `model ${mrr(rows, r => r.winnerRank)} / ${winPct(rows, r => r.winnerRank).padStart(5)}   ` +
    `market ${mrr(rows, r => r.marketWinnerRank)} / ${winPct(rows, r => r.marketWinnerRank).padStart(5)}`
  );
}

async function main() {
  const cfg = JSON.parse(fs.readFileSync(arg('--config') ?? 'data/cfg-ht-with-de.json', 'utf-8'));
  const ds = loadDataset(arg('--dataset') ?? 'calibration-dataset-5y.json', { primeDriverRatings: false });
  const { train, holdout } = chronologicalHoldout(ds, 0.2, 6);
  primeDriverRatings(train);

  const rows: Row[] = [];
  for (const day of holdout) {
    for (const race of day.races) {
      const res = await RaceResultProcessor.processRaceResult(race.raceData, race.rawKmTimes, cfg.weights, undefined, cfg.postPositionCurves);
      if (!res.analysisComplete) continue;
      const real = res.horses.filter((h: any) => !h.modernNormalizedResult?.isEstimated && h.modernNormalizedResult?.modernNormalizedTime);
      if (real.length < 4) continue;
      const key = (h: any) => h.horseKey ?? String(h.horseId);

      let winner: string | undefined;
      for (const [k, v] of race.actualResults) if (v.position === 1) { winner = k; break; }
      if (!winner) continue;
      const winnerRank = real.findIndex((h: any) => key(h) === winner) + 1;
      if (winnerRank === 0) continue;

      const secs = (h: any) => {
        const t = h.modernNormalizedResult.modernNormalizedTime;
        return t.minutes * 60 + t.seconds + t.tenths / 10;
      };
      const margin = real.length >= 2 ? secs(real[1]) - secs(real[0]) : 0;

      const mkt = marketRankByKey(race.raceData, real.map(key));
      const marketWinnerRank = mkt?.get(winner);
      const marketTop = mkt ? [...mkt.entries()].find(([, v]) => v === 1)?.[0] : undefined;

      rows.push({
        winnerRank,
        marketWinnerRank,
        agrees: marketTop !== undefined && marketTop === key(real[0]),
        margin,
        fieldSize: real.length,
      });
    }
  }

  const n = rows.length;
  console.log(`\nholdout races scored: ${n}\n`);
  console.log('subset                             races          model MRR / win    market MRR / win');
  console.log('-'.repeat(96));
  report('ALL', rows, n);
  console.log();
  report('model agrees with market', rows.filter(r => r.agrees), n);
  report('model disagrees', rows.filter(r => !r.agrees), n);
  console.log();
  report('margin >= 0.8s (spik)', rows.filter(r => r.margin >= 0.8), n);
  report('margin 0.3-0.8s (favorit)', rows.filter(r => r.margin >= 0.3 && r.margin < 0.8), n);
  report('margin < 0.3s (oppet)', rows.filter(r => r.margin < 0.3), n);
  console.log();
  report('agrees AND margin >= 0.8s', rows.filter(r => r.agrees && r.margin >= 0.8), n);
  report('agrees AND margin >= 0.3s', rows.filter(r => r.agrees && r.margin >= 0.3), n);
  console.log();
  report('field <= 9', rows.filter(r => r.fieldSize <= 9), n);
  report('field >= 13', rows.filter(r => r.fieldSize >= 13), n);
  console.log('-'.repeat(96));
  console.log('\nA subset only counts if it is both above 0.60 AND large enough to bet.');
}

main().catch(e => { console.error(e); process.exit(1); });
