/**
 * Export a per-horse feature matrix for non-linear modelling.
 *
 * The current model is strictly additive: every factor contributes seconds
 * independently, so it cannot express "a bad gate matters more in a big field"
 * or "layoff matters more for older horses". Whether those interactions carry
 * real signal is an open question, and answering it needs the features in a
 * form a tree model can consume.
 *
 * Rather than re-deriving the factors, this reuses the pipeline's own
 * adjustment components -- already engineered, already unit-tested -- by
 * scoring each race with unit weights and reading the per-factor breakdown that
 * applyModernKmNormalization returns. Three passes are needed because a few
 * components are summed together before they surface: the driver term merges
 * driverPerformance, driverForm and driverEmpirical, and equipment merges shoe
 * and sulky. driverEmpirical and shoeType are isolated with their own passes,
 * since driverEmpirical is the strongest feature in the repo and should not
 * reach the model blended into two weaker ones.
 *
 * Every feature is centred within its race. Ranking is a within-race problem,
 * so only relative values carry information -- an uncentred km-time would let
 * the model learn "this was a fast race" instead of "this was a fast horse".
 *
 * Usage:
 *   npx tsx scripts/export-features.ts [--dataset f.json] [--out data/features.csv]
 */
import * as fs from 'fs';
import { RaceResultProcessor } from '../src/components/v75/services/raceResultProcessor';
import { DEFAULT_WEIGHTS, NormalizationWeights } from '../src/services/modernKm/types';
import { WEIGHT_PRESETS } from '../src/services/modernKm/presetWeights';
import { loadDataset, primeDriverRatings } from './cli-common';
import { chronologicalHoldout } from '../src/services/calibration/datasetSplits';

const arg = (f: string) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : undefined; };

const unit = (over: Partial<NormalizationWeights> = {}, base = 0): NormalizationWeights => {
  const w: any = {};
  for (const k of Object.keys(DEFAULT_WEIGHTS)) w[k] = base;
  return { ...w, ...over } as NormalizationWeights;
};

// Components that arrive already separated under a full unit-weight pass.
const PLAIN = [
  'postPosition', 'track', 'form', 'distance', 'volteStartDistancePenalty',
  'startPoints', 'placePercentage', 'horseWinPercentage', 'earningsPerStart',
  'gallopRisk', 'layoffPenalty', 'ageFactor', 'genderAdjustment',
  'consistencyFactor', 'trainer', 'oddsHistorical', 'oddsLive',
  'betDistribution', 'shoeChange', 'equipment', 'driver',
] as const;

async function main() {
  const curves = WEIGHT_PRESETS.find(p => p.name.startsWith('V42'))!.postPositionCurves;
  const ds = loadDataset(arg('--dataset') ?? 'calibration-dataset-5y.json', { primeDriverRatings: false });
  const { train, holdout } = chronologicalHoldout(ds, 0.2, 6);
  primeDriverRatings(train);
  const holdoutDates = new Set(holdout.map((d: any) => d.date));

  const cols = [
    'raceId', 'date', 'split', 'won', 'fieldSize',
    'rawKmTime', ...PLAIN, 'driverEmpiricalOnly', 'shoeTypeOnly',
    'logPOdds', 'logPSpel',
  ];
  const rows: string[] = [cols.join(',')];
  let races = 0, skipped = 0;

  for (const day of ds) {
    for (const race of day.races) {
      const horses: any[] = race.raceData?.horses ?? [];
      const usable = horses.filter(h => h.horseKey && h.liveOdds > 0 && h.betDistribution > 0);
      if (usable.length < 4 || usable.length !== horses.length) { skipped++; continue; }

      const [all, deOnly, shoeOnly] = await Promise.all([
        RaceResultProcessor.processRaceResult(race.raceData, race.rawKmTimes, unit({}, 1), undefined, curves),
        RaceResultProcessor.processRaceResult(race.raceData, race.rawKmTimes, unit({ driverEmpirical: 1 }), undefined, curves),
        RaceResultProcessor.processRaceResult(race.raceData, race.rawKmTimes, unit({ shoeType: 1 }), undefined, curves),
      ]);
      if (!all.analysisComplete) { skipped++; continue; }

      const key = (h: any) => h.horseKey ?? String(h.horseId);
      const real = all.horses.filter((h: any) => !h.modernNormalizedResult?.isEstimated && h.modernNormalizedResult?.modernNormalizedTime);
      if (real.length < 4) { skipped++; continue; }
      if (!real.every((h: any) => usable.some(u => u.horseKey === key(h)))) { skipped++; continue; }

      const byKey = (res: any) => new Map(res.horses.map((h: any) => [key(h), h]));
      const deMap = byKey(deOnly), shoeMap = byKey(shoeOnly);

      const oSum = usable.reduce((s, h) => s + 1 / h.liveOdds, 0);
      const sSum = usable.reduce((s, h) => s + h.betDistribution, 0);

      const recs = real.map((h: any) => {
        const u = usable.find(x => x.horseKey === key(h))!;
        const a = h.modernNormalizedResult.adjustments ?? {};
        const t = h.modernNormalizedResult.rawTime;
        const f: Record<string, number> = {
          rawKmTime: t ? t.minutes * 60 + t.seconds + t.tenths / 10 : 0,
          driverEmpiricalOnly: (deMap.get(key(h)) as any)?.modernNormalizedResult?.adjustments?.driver ?? 0,
          shoeTypeOnly: (shoeMap.get(key(h)) as any)?.modernNormalizedResult?.adjustments?.equipment ?? 0,
          logPOdds: Math.log((1 / u.liveOdds) / oSum),
          logPSpel: Math.log(u.betDistribution / sSum),
        };
        for (const c of PLAIN) f[c] = a[c] ?? 0;
        return { key: key(h), f, won: race.actualResults.get(key(h))?.position === 1 ? 1 : 0 };
      });

      // Centre within race: only relative position carries ranking information.
      for (const c of [...PLAIN, 'rawKmTime', 'driverEmpiricalOnly', 'shoeTypeOnly', 'logPOdds', 'logPSpel']) {
        const mean = recs.reduce((s, r) => s + r.f[c], 0) / recs.length;
        for (const r of recs) r.f[c] -= mean;
      }

      races++;
      const split = holdoutDates.has(day.date) ? 'holdout' : 'train';
      for (const r of recs) {
        rows.push([
          race.raceId, day.date, split, r.won, recs.length,
          ...[...['rawKmTime'], ...PLAIN, 'driverEmpiricalOnly', 'shoeTypeOnly', 'logPOdds', 'logPSpel']
            .map(c => r.f[c].toFixed(5)),
        ].join(','));
      }
    }
  }

  const out = arg('--out') ?? 'data/features.csv';
  fs.mkdirSync(out.replace(/[^/\\]+$/, '') || '.', { recursive: true });
  fs.writeFileSync(out, rows.join('\n') + '\n');
  console.log(`races used ${races}, skipped ${skipped}, rows ${rows.length - 1}`);
  console.log(`wrote ${out}`);
}

main().catch(e => { console.error(e); process.exit(1); });
