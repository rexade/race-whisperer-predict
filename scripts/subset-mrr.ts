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
  distance: number;
  startMethod: string;
  /** Handicap: runners start off more than one distance (tillägg tiers). */
  isHandicap: boolean;
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

      const horseDistances = (race.raceData?.horses ?? [])
        .map((h: any) => h.distance)
        .filter((d: any) => Number.isFinite(d));
      rows.push({
        winnerRank,
        marketWinnerRank,
        agrees: marketTop !== undefined && marketTop === key(real[0]),
        margin,
        fieldSize: real.length,
        distance: race.raceData?.distance ?? 0,
        startMethod: String(race.raceData?.startMethod ?? '').toLowerCase(),
        isHandicap: new Set(horseDistances).size > 1,
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
  console.log();
  // Distance bands follow the calculator's own buckets (postPositionCalculator:
  // SHORT_DISTANCE_MAX 1640, MEDIUM_DISTANCE_MAX 2400) so the slices line up
  // with how the model already treats distance.
  report('sprint  (<= 1640m)', rows.filter(r => r.distance > 0 && r.distance <= 1640), n);
  report('mid     (1641-2400m)', rows.filter(r => r.distance > 1640 && r.distance <= 2400), n);
  report('stayer  (> 2400m)', rows.filter(r => r.distance > 2400), n);
  console.log();
  report('autostart', rows.filter(r => r.startMethod === 'auto'), n);
  report('volte', rows.filter(r => r.startMethod === 'volte'), n);
  console.log();
  report('handicap (tillagg tiers)', rows.filter(r => r.isHandicap), n);
  report('level start', rows.filter(r => !r.isHandicap), n);
  console.log();
  // volte, handicap and stayer may be three views of the same races -- Swedish
  // handicaps are usually volte over distance -- so cross-tab before reading
  // them as three separate findings.
  const volte = rows.filter(r => r.startMethod === 'volte');
  const hcp = rows.filter(r => r.isHandicap);
  const both = rows.filter(r => r.startMethod === 'volte' && r.isHandicap);
  const stayers = rows.filter(r => r.distance > 2400);
  const stayerVolte = stayers.filter(r => r.startMethod === 'volte');
  console.log(`overlap: volte ${volte.length}, handicap ${hcp.length}, both ${both.length}`);
  console.log(`         stayers ${stayers.length}, of which volte ${stayerVolte.length}`);
  report('autostart AND level start', rows.filter(r => r.startMethod === 'auto' && !r.isHandicap), n);
  console.log('-'.repeat(96));
  console.log('\nA subset only counts if it is both above 0.60 AND large enough to bet.');
}

main().catch(e => { console.error(e); process.exit(1); });
