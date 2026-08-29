/**
 * Does the model's disagreement with the market carry information?
 *
 * Win accuracy compares two rankings over every race, which hides the only
 * races where the model makes an independent claim. This splits the holdout
 * into races where model rank 1 == market rank 1 and races where it doesn't,
 * then reports who actually won the disagreements. A model that merely echoes
 * the market with noise loses these; one with orthogonal signal wins some.
 */
import * as fs from 'fs';
import { chronologicalHoldout } from '../src/services/calibration/datasetSplits';
import { evaluateWeights, marketRankByKey } from '../src/services/calibration/historicalCalibrationService';
import { RaceResultProcessor } from '../src/components/v75/services/raceResultProcessor';
import { loadDataset, primeDriverRatings } from './cli-common';

function argValue(f: string) { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : undefined; }

async function main() {
  const datasetPath = argValue('--dataset') ?? 'calibration-dataset-full.json';
  const cfgPath = argValue('--config');
  if (!cfgPath) { console.error('Usage: --config data/cfg-X.json [--dataset f.json]'); process.exit(1); }
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));

  const dataset = loadDataset(datasetPath, { primeDriverRatings: false });
  const { train, holdout } = chronologicalHoldout(dataset, 0.2, 6);
  primeDriverRatings(train);

  let agree = 0, agreeWin = 0, disagree = 0, modelWin = 0, marketWin = 0, neither = 0;

  for (const d of holdout) {
    for (const race of d.races) {
      const r = await RaceResultProcessor.processRaceResult(race.raceData, race.rawKmTimes, cfg.weights, undefined, cfg.postPositionCurves);
      if (!r.analysisComplete) continue;
      const real = r.horses.filter(h => !h.modernNormalizedResult?.isEstimated && h.modernNormalizedResult?.modernNormalizedTime);
      if (real.length < 2) continue;
      const key = (h: any) => h.horseKey ?? String(h.horseId);

      let winner: string | undefined;
      for (const [k, a] of race.actualResults) if (a.position === 1) { winner = k; break; }
      if (!winner || !real.some(h => key(h) === winner)) continue;

      const mkt = marketRankByKey(race.raceData, real.map(key));
      if (!mkt) continue;
      const modelTop = key(real[0]);
      const marketTop = [...mkt.entries()].find(([, v]) => v === 1)?.[0];
      if (!marketTop) continue;

      if (modelTop === marketTop) { agree++; if (winner === modelTop) agreeWin++; }
      else {
        disagree++;
        if (winner === modelTop) modelWin++;
        else if (winner === marketTop) marketWin++;
        else neither++;
      }
    }
  }

  const pct = (n: number, d: number) => d ? `${(n / d * 100).toFixed(1)}%` : 'n/a';
  console.log(`\nConfig: ${cfg.label}\n`);
  console.log(`AGREE    ${String(agree).padStart(3)} races   winner hit ${String(agreeWin).padStart(3)}  (${pct(agreeWin, agree)})`);
  console.log(`DISAGREE ${String(disagree).padStart(3)} races   model ${String(modelWin).padStart(3)} (${pct(modelWin, disagree)})   market ${String(marketWin).padStart(3)} (${pct(marketWin, disagree)})   neither ${neither}`);
}
main().catch(e => { console.error(e); process.exit(1); });
