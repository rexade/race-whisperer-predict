/**
 * Does odds drift predict winners beyond the closing price?
 *
 * The hypothesis: money arriving late is better informed, so a horse shortening
 * from 12 to 7 in the final hours is telling you something the number "7" alone
 * does not. This is the one idea a single snapshot cannot answer by
 * construction -- drift is a property of the price CHANGING -- which is why
 * scripts/snapshot-odds.ts exists and why this cannot be backtested.
 *
 * The test is deliberately narrow: does drift add anything ON TOP OF the final
 * price? Closing odds already contain most of what the crowd knows, so anything
 * that cannot beat them is not worth acting on.
 *
 *   npx tsx scripts/odds-drift.ts
 *
 * Two readings per horse are compared: one ~24h before the card's betting
 * deadline, one shortly before it. Both are clocked to the deadline -- the
 * first leg's start -- because that is when the ticket locks; odds later in the
 * afternoon move but cannot be acted on. Anchors are a parameter, so once
 * enough cards are in, the best pair can be swept for rather than guessed.
 */
import './node-polyfills';
import * as fs from 'fs';

const ATG = 'https://www.atg.se/services/racinginfo/v1/api';
const realFetch = globalThis.fetch.bind(globalThis);
(globalThis as any).fetch = (i: any, o?: any) =>
  realFetch(typeof i === 'string' && i.startsWith('/api/atg/') ? ATG + i.slice('/api/atg'.length) : i, o);

import {
  DEFAULT_ANCHORS, buildRaceObservations, conditionalLogit, pairByAnchors,
} from '../src/services/analysis/oddsDrift';
import type { Anchors, SnapshotRow } from '../src/services/analysis/oddsDrift';

const arg = (f: string) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : undefined; };
const pct = (n: number, d: number) => (d === 0 ? '0.0%' : `${((100 * n) / d).toFixed(1)}%`);
const hrs = (m: number) => (m % 60 === 0 ? `${m / 60}h` : `${m}min`);

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

function report(label: string, anchors: Anchors, rows: SnapshotRow[], winnerNames: Map<string, string>) {
  const { paired, dropped } = pairByAnchors(rows, anchors);
  const horses = new Set(rows.map(r => `${r.raceId}|${r.startNumber}`)).size;

  console.log(`\n── ${label}: ${hrs(anchors.early)} out vs ${hrs(anchors.late)} out ──`);
  console.log(`  ${paired.length}/${horses} horses paired (${pct(paired.length, horses)})`);
  console.log(`  dropped: ${dropped.noEarly} no early, ${dropped.noLate} no late,`
    + ` ${dropped.noOdds} unpriced, ${dropped.outsideWindow} outside window`);
  // Paired plus dropped must equal the horse count. If it does not, horses are
  // going missing somewhere and every ratio below is measuring the wrong thing.
  const accounted = paired.length + dropped.noEarly + dropped.noLate + dropped.noOdds + dropped.outsideWindow;
  if (accounted !== horses) console.log(`  ! ${horses - accounted} horses unaccounted for - diagnostics are wrong`);

  const winners = new Map<string, number>();
  for (const [raceId, name] of winnerNames) {
    const match = paired.find(p => p.raceId === raceId && p.horseName === name);
    if (match) winners.set(raceId, match.startNumber);
  }

  const { observations, droppedRaces, droppedThinFields } = buildRaceObservations(paired, winners);
  console.log(`  ${observations.length} fittable races`
    + ` (${droppedRaces} winner not in field, ${droppedThinFields} field collapsed)`);

  // One race contributes ONE winner, so races -- not horses -- are the sample
  // size. Two covariates want well over a hundred before a null means anything.
  if (observations.length < 40) {
    console.log(`  not enough to fit: ${observations.length} races, need ~40 minimum and 300+ to trust a null`);
    return;
  }

  const fit = conditionalLogit(observations);
  if (!fit.converged) console.log(`  ! did not converge in ${fit.iterations} iterations - treat with suspicion`);

  console.log(`    log(final prob)  b=${fit.coefficients[0].toFixed(4)}`
    + `  se=${fit.standardErrors[0].toFixed(4)}  z=${fit.z[0].toFixed(2)}`);
  console.log(`    drift            b=${fit.coefficients[1].toFixed(4)}`
    + `  se=${fit.standardErrors[1].toFixed(4)}  z=${fit.z[1].toFixed(2)}`);

  const z = Math.abs(fit.z[1]);
  if (z < 1.96) {
    console.log(`    => nothing detectable beyond the closing price (|z|=${z.toFixed(2)} < 1.96);`
      + ` ${observations.length} races rules out a large effect, not a small one`);
  } else {
    console.log(`    => drift carries information the closing price does not (|z|=${z.toFixed(2)});`
      + ` ${fit.coefficients[1] > 0 ? 'shortening' : 'drifting out'} predicts winning`);
  }
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
  console.log(`\n${rows.length} rows, ${captures} card-captures, from ${inPath}`);

  const cache: Record<string, string> = fs.existsSync(cachePath)
    ? JSON.parse(fs.readFileSync(cachePath, 'utf8')) : {};

  const winnerNames = new Map<string, string>();
  let unrun = 0;
  for (const raceId of [...new Set(rows.map(r => r.raceId))]) {
    const name = await winnerNameOf(raceId, cache);
    if (name) winnerNames.set(raceId, name);
    else unrun++;
  }
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
  console.log(`${winnerNames.size} races settled, ${unrun} not yet run`);

  report('drift', DEFAULT_ANCHORS, rows, winnerNames);
  console.log('');
}

main().catch(e => { console.error(e); process.exit(1); });
