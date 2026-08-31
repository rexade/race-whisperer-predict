/**
 * Can we tell in advance when the top pick is about to run nowhere?
 *
 * Error analysis put 30.8% of losses in a distinct category: the pick does not
 * lose narrowly, it finishes 6th or worse. That is a different failure from
 * being beaten by a neck, and a more useful one, because ranking better inside
 * the near-misses is exactly where noise lives and the market has no answer
 * either.
 *
 * "Will this pick run nowhere?" is a separate question from "which horse is
 * fastest", and the pipeline already computes candidates for it -- confidence,
 * the reliability multiplier, gallop rate, thin-sample and stale-form flags --
 * that nothing has ever been checked against outcomes.
 *
 * For each signal this reports the flop rate (pick finishes 6th or worse) when
 * the signal fires against when it does not. A signal is only useful if the two
 * differ by enough to change a ticket AND it fires often enough to matter.
 *
 * Usage: npx tsx scripts/flop-signals.ts [--config data/cfg-tillagg.json]
 */
import * as fs from 'fs';
import { chronologicalHoldout } from '../src/services/calibration/datasetSplits';
import { RaceResultProcessor } from '../src/components/v75/services/raceResultProcessor';
import { loadDataset, primeDriverRatings } from './cli-common';

const arg = (f: string) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : undefined; };

interface Pick {
  flopped: boolean;      // finished 6th or worse (or not at all)
  won: boolean;
  confidence: number | null;
  reliability: number | null;
  uncertain: boolean;
  gallopRate: number;
  thinSample: boolean;
  staleForm: boolean;
  abroad: boolean;
  margin: number;        // predicted-time gap to our own rank 2
}

function report(label: string, picks: Pick[], firing: (p: Pick) => boolean): void {
  const on = picks.filter(firing);
  const off = picks.filter(p => !firing(p));
  if (on.length < 20) {
    console.log(`  ${label.padEnd(30)} fires ${String(on.length).padStart(3)}  — too rare to judge`);
    return;
  }
  const flop = (a: Pick[]) => a.filter(p => p.flopped).length / a.length * 100;
  const win = (a: Pick[]) => a.filter(p => p.won).length / a.length * 100;
  const delta = flop(on) - flop(off);
  const flag = Math.abs(delta) >= 8 ? '  <<' : '';
  console.log(
    `  ${label.padEnd(30)} fires ${String(on.length).padStart(3)}/${picks.length}   ` +
    `flop ${flop(on).toFixed(1).padStart(5)}% vs ${flop(off).toFixed(1).padStart(5)}%   ` +
    `(win ${win(on).toFixed(1).padStart(5)}% vs ${win(off).toFixed(1).padStart(5)}%)   ` +
    `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}pp${flag}`
  );
}

async function main() {
  const cfg = JSON.parse(fs.readFileSync(arg('--config') ?? 'data/cfg-tillagg.json', 'utf-8'));
  const ds = loadDataset(arg('--dataset') ?? 'calibration-dataset-5y.json', { primeDriverRatings: false });
  const { train, holdout } = chronologicalHoldout(ds, 0.2, 6);
  primeDriverRatings(train);

  const picks: Pick[] = [];
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

      const pick: any = real[0];
      const actual = race.actualResults.get(key(pick));
      // No recorded finish means it did not complete — that is the worst case of
      // running nowhere, not missing data to be skipped.
      const pos = actual?.position;
      const flags = pick.confidenceFlags ?? {};

      picks.push({
        flopped: pos === undefined || pos === null || pos <= 0 || pos >= 6,
        won: pos === 1,
        confidence: typeof pick.confidence === 'number' ? pick.confidence : null,
        reliability: typeof pick.confidenceMultiplier === 'number' ? pick.confidenceMultiplier : null,
        uncertain: pick.uncertain === true,
        gallopRate: typeof pick.gallopRate === 'number' ? pick.gallopRate : 0,
        thinSample: flags.lowSampleSize === true,
        staleForm: flags.staleForm === true,
        abroad: pick.historySource === 'abroad',
        margin: real.length >= 2 ? secs(real[1]) - secs(real[0]) : 0,
      });
    }
  }

  const base = picks.filter(p => p.flopped).length / picks.length * 100;
  console.log(`\ntop picks scored: ${picks.length} — baseline flop rate (6th or worse): ${base.toFixed(1)}%\n`);
  console.log('signal                          fires        flop rate on/off             win rate on/off        delta');
  console.log('-'.repeat(112));
  report('uncertain (fallback time)', picks, p => p.uncertain);
  report('thin km-time sample', picks, p => p.thinSample);
  report('stale form (90+ days)', picks, p => p.staleForm);
  report('foreign-track history', picks, p => p.abroad);
  report('gallop rate > 10%', picks, p => p.gallopRate > 0.1);
  report('gallop rate > 20%', picks, p => p.gallopRate > 0.2);
  report('confidence < 50', picks, p => p.confidence !== null && p.confidence < 50);
  report('confidence < 70', picks, p => p.confidence !== null && p.confidence < 70);
  report('reliability mult < 0.7', picks, p => p.reliability !== null && p.reliability < 0.7);
  console.log();
  report('margin < 0.3s (oppet leg)', picks, p => p.margin < 0.3);
  report('margin >= 0.8s (spik leg)', picks, p => p.margin >= 0.8);
  console.log('-'.repeat(112));
  console.log('\nA signal earns a place only if the flop-rate gap is large AND it fires often enough to change a ticket.');
}

main().catch(e => { console.error(e); process.exit(1); });
