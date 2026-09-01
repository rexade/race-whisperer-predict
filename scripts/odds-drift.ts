/**
 * Does odds drift predict winners beyond the closing price?
 *
 * The hypothesis: money arriving late is better informed, so a horse shortening
 * from 12 to 7 in the final hours is telling you something the number "7" alone
 * does not. This is the one idea that a single snapshot cannot answer by
 * construction -- drift is a property of the price CHANGING -- which is why
 * scripts/snapshot-odds.ts exists and why this cannot be backtested.
 *
 * The test is deliberately narrow: does drift add anything ON TOP OF the final
 * price? Final odds are a strong baseline that already contains most of what
 * the crowd knows, so beating them is the only result worth acting on.
 *
 *   npx tsx scripts/odds-drift.ts
 *
 * Reads data/odds-snapshots.jsonl, pairs each horse's capture nearest 24h out
 * with its capture nearest 1h out, normalizes both across the race so the
 * tightening overround is not mistaken for drift, joins finishing positions,
 * and fits a race-level conditional logit. Results are cached in
 * data/race-results-cache.json so reruns cost nothing.
 */
import './node-polyfills';
import * as fs from 'fs';

const ATG = 'https://www.atg.se/services/racinginfo/v1/api';
const realFetch = globalThis.fetch.bind(globalThis);
(globalThis as any).fetch = (i: any, o?: any) =>
  realFetch(typeof i === 'string' && i.startsWith('/api/atg/') ? ATG + i.slice('/api/atg'.length) : i, o);

import {
  buildRaceObservations, conditionalLogit, pairByAnchors,
  EARLY_ANCHOR, LATE_ANCHOR,
} from '../src/services/analysis/oddsDrift';
import type { SnapshotRow } from '../src/services/analysis/oddsDrift';

const arg = (f: string) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : undefined; };

const pct = (n: number, d: number) => (d === 0 ? '0.0%' : `${((100 * n) / d).toFixed(1)}%`);

async function winnerNameOf(raceId: string, cache: Record<string, string>): Promise<string | null> {
  if (cache[raceId]) return cache[raceId];
  const r = await realFetch(`${ATG}/races/${raceId}`);
  if (!r.ok) return null;
  const d: any = await r.json();
  const w = (d.starts ?? []).find((s: any) => (s.result ?? {}).place === 1);
  const name = w?.horse?.name ?? null;
  // Only settled races are cached; an unrun race must stay refetchable.
  if (name) cache[raceId] = name;
  return name;
}

async function main() {
  const inPath = arg('--in') ?? 'data/odds-snapshots.jsonl';
  const cachePath = arg('--cache') ?? 'data/race-results-cache.json';

  if (!fs.existsSync(inPath)) {
    console.error(`No snapshots at ${inPath}. Run scripts/snapshot-odds.ts --auto first.`);
    process.exit(1);
  }

  const rows: SnapshotRow[] = fs.readFileSync(inPath, 'utf8')
    .split('\n').filter(l => l.trim()).map(l => JSON.parse(l));

  const captures = new Set(rows.map((r: any) => `${r.capturedAt}|${r.raceId}`)).size;
  console.log(`\n${rows.length} rows, ${captures} card-captures, from ${inPath}\n`);

  const { paired, dropped } = pairByAnchors(rows);
  const horses = new Set(rows.map(r => `${r.raceId}|${r.startNumber}`)).size;

  console.log(`Pairing (${EARLY_ANCHOR}min out vs ${LATE_ANCHOR}min out):`);
  console.log(`  ${paired.length}/${horses} horses paired (${pct(paired.length, horses)})`);
  console.log(`  dropped: ${dropped.noEarly} no early capture, ${dropped.noLate} no late, ${dropped.noOdds} unpriced`);
  if (dropped.noLate > paired.length) {
    console.log(`  ! late captures dominate the drops - the surviving sample is skewed`);
    console.log(`    toward cards the scheduler caught near post, which is the variable under test.`);
  }

  const cache: Record<string, string> = fs.existsSync(cachePath)
    ? JSON.parse(fs.readFileSync(cachePath, 'utf8')) : {};

  const raceIds = [...new Set(paired.map(p => p.raceId))];
  const winners = new Map<string, number>();
  let unrun = 0;
  for (const raceId of raceIds) {
    const name = await winnerNameOf(raceId, cache);
    if (!name) { unrun++; continue; }
    const match = paired.find(p => p.raceId === raceId && p.horseName === name);
    if (match) winners.set(raceId, match.startNumber);
  }
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));

  const { observations, droppedRaces, droppedThinFields } = buildRaceObservations(paired, winners);

  console.log(`\nRaces:`);
  console.log(`  ${observations.length} fittable, ${unrun} not yet run,`
    + ` ${droppedRaces} winner not in paired field, ${droppedThinFields} field collapsed`);

  // One race contributes ONE winner, so races -- not horses -- are the sample
  // size. Two covariates want well over a hundred before a null means anything.
  if (observations.length < 40) {
    console.log(`\nNot enough to fit yet. ${observations.length} races is below the ~40 minimum,`);
    console.log(`and a trustworthy answer wants 300+. Keep the scheduled capture running.`);
    return;
  }

  const fit = conditionalLogit(observations);
  if (!fit.converged) console.log(`\n! fit did not converge in ${fit.iterations} iterations - treat with suspicion`);

  const [market, drift] = [0, 1];
  console.log(`\nConditional logit, win ~ log(final prob) + drift:`);
  console.log(`  log(final prob)  b=${fit.coefficients[market].toFixed(4)}`
    + `  se=${fit.standardErrors[market].toFixed(4)}  z=${fit.z[market].toFixed(2)}`);
  console.log(`  drift            b=${fit.coefficients[drift].toFixed(4)}`
    + `  se=${fit.standardErrors[drift].toFixed(4)}  z=${fit.z[drift].toFixed(2)}`);

  const z = Math.abs(fit.z[drift]);
  console.log('');
  if (z < 1.96) {
    console.log(`  Drift adds nothing detectable beyond the closing price (|z|=${z.toFixed(2)} < 1.96).`);
    console.log(`  With ${observations.length} races this rules out a large effect, not a small one.`);
  } else {
    console.log(`  Drift carries information the closing price does not (|z|=${z.toFixed(2)}).`);
    console.log(`  ${fit.coefficients[drift] > 0 ? 'Shortening' : 'Drifting out'} predicts winning.`);
    console.log(`  Before acting: re-run after more cards, and check it is not one card driving it.`);
  }
  console.log('');
}

main().catch(e => { console.error(e); process.exit(1); });
