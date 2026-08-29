/**
 * Score a finished card: model picks, market favourite, and pool-value flags
 * against what actually won.
 *
 * One card settles nothing, so every leg is appended to a JSONL log keyed by
 * raceId and re-running a date replaces rather than duplicates it. Accumulated
 * over weeks that log becomes the forward test -- the only honest way left to
 * check the holdout claims, since the configs are frozen and every future card
 * is genuinely out of sample. Refitting against these results would destroy
 * exactly the property that makes them worth collecting.
 *
 * Several configs can be scored on the SAME legs, which is what makes a
 * head-to-head meaningful: paired on identical races, the comparison is far
 * more sensitive than two independent win rates, because the many legs where
 * both agree contribute no noise to the difference.
 *
 *   npx tsx scripts/score-card.ts --date 2026-09-05 --type V85 \
 *     --config data/cfg-ht-with-de.json,data/cfg-ht-without-de.json
 *   npx tsx scripts/score-card.ts --summary
 */
import './node-polyfills';
import * as fs from 'fs';

const ATG = 'https://www.atg.se/services/racinginfo/v1/api';
const realFetch = globalThis.fetch.bind(globalThis);
(globalThis as any).fetch = (i: any, o?: any) =>
  realFetch(typeof i === 'string' && i.startsWith('/api/atg/') ? ATG + i.slice('/api/atg'.length) : i, o);

import { fetchV75GameInfo, fetchRaceDataForGame } from '../src/services/v75CalendarApi';
import { RaceResultProcessor } from '../src/components/v75/services/raceResultProcessor';
import { calculateRawKmTimesForRaceWithId } from '../src/services/kmTimeProcessor';
import { computeDriverRatings, saveDriverRatings } from '../src/services/calibration/driverRatingService';
import { hydrateDataset } from './cli-common';
import type { GameType } from '../src/config/game';

const arg = (f: string) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : undefined; };

interface Pick { config: string; pick: string; hit: boolean }
interface LegRecord {
  date: string; type: string; raceId: string; leg: number;
  winner: string; marketFav: string; marketHit: boolean;
  picks: Pick[];
  overbetFlagged: number; winnerFlag: 'overbet' | 'underbet' | null;
}

function appendLog(logPath: string, records: LegRecord[]): void {
  const existing: LegRecord[] = fs.existsSync(logPath)
    ? fs.readFileSync(logPath, 'utf-8').split('\n').filter(Boolean).map(l => JSON.parse(l))
    : [];
  const incoming = new Set(records.map(r => r.raceId));
  const merged = [...existing.filter(r => !incoming.has(r.raceId)), ...records];
  merged.sort((a, b) => (a.date + a.raceId).localeCompare(b.date + b.raceId));
  fs.mkdirSync(logPath.replace(/[^/\\]+$/, '') || '.', { recursive: true });
  fs.writeFileSync(logPath, merged.map(r => JSON.stringify(r)).join('\n') + '\n');
}

function summarise(logPath: string): void {
  if (!fs.existsSync(logPath)) { console.log(`No forward-test log at ${logPath} yet.`); return; }
  const rows: LegRecord[] = fs.readFileSync(logPath, 'utf-8').split('\n').filter(Boolean).map(l => JSON.parse(l))
    .filter((r: LegRecord) => Array.isArray(r.picks));
  if (rows.length === 0) { console.log('Log has no records in the current format.'); return; }

  const dates = [...new Set(rows.map(r => r.date))].sort();
  const n = rows.length;
  const pct = (a: number, b: number) => b ? `${(a / b * 100).toFixed(1)}%` : 'n/a';
  console.log(`\nForward test — ${dates.length} card(s), ${n} legs (${dates[0]} … ${dates[dates.length - 1]})\n`);

  const configs = [...new Set(rows.flatMap(r => r.picks.map(p => p.config)))];
  const market = rows.filter(r => r.marketHit).length;
  console.log(`  ${'market favourite'.padEnd(30)} ${String(market).padStart(4)}/${n}   ${pct(market, n)}`);
  for (const c of configs) {
    const hits = rows.filter(r => r.picks.find(p => p.config === c)?.hit).length;
    const edge = (hits - market) / n * 100;
    console.log(`  ${c.padEnd(30)} ${String(hits).padStart(4)}/${n}   ${pct(hits, n)}   edge ${edge >= 0 ? '+' : ''}${edge.toFixed(1)}pp`);
  }

  // Paired head-to-head: only legs where the two disagree carry information,
  // so report those separately rather than letting agreement dilute the split.
  if (configs.length === 2) {
    const [a, b] = configs;
    let aOnly = 0, bOnly = 0, both = 0, neither = 0;
    for (const r of rows) {
      const ha = !!r.picks.find(p => p.config === a)?.hit;
      const hb = !!r.picks.find(p => p.config === b)?.hit;
      if (ha && hb) both++; else if (ha) aOnly++; else if (hb) bOnly++; else neither++;
    }
    const disagreed = rows.filter(r => {
      const pa = r.picks.find(p => p.config === a)?.pick;
      const pb = r.picks.find(p => p.config === b)?.pick;
      return pa && pb && pa !== pb;
    }).length;
    console.log(`\n  head-to-head: both hit ${both}, only "${a}" ${aOnly}, only "${b}" ${bOnly}, neither ${neither}`);
    console.log(`  legs where they picked different horses: ${disagreed}/${n}`);
    console.log(`  (only those ${disagreed} legs carry information about which is better)`);
  }

  const flagged = rows.reduce((s, r) => s + r.overbetFlagged, 0);
  const overbetWins = rows.filter(r => r.winnerFlag === 'overbet').length;
  console.log(`\n  horses flagged OVERBET: ${flagged}, of which won: ${overbetWins} (${pct(overbetWins, flagged)})`);
  console.log(`  legs won by an UNDERBET horse: ${rows.filter(r => r.winnerFlag === 'underbet').length}/${n}`);
  console.log(`\n  reference: holdout model 39.1% / market 36.9%; overbet bucket ~13-15% win rate`);
}

async function winnerOf(raceId: string): Promise<string | null> {
  const r = await realFetch(`${ATG}/races/${raceId}`);
  if (!r.ok) return null;
  const d: any = await r.json();
  const w = (d.starts ?? []).find((s: any) => (s.result ?? {}).place === 1);
  return w?.horse?.name ?? null;
}

async function main() {
  const logPath = arg('--log') ?? 'data/forward-test.jsonl';
  if (process.argv.includes('--summary')) { summarise(logPath); return; }

  const date = arg('--date') ?? new Date().toISOString().split('T')[0];
  const type = (arg('--type') ?? 'V85') as GameType;
  const cfgPaths = (arg('--config') ?? 'data/cfg-ht-with-de.json,data/cfg-ht-without-de.json').split(',').map(s => s.trim());
  const configs = cfgPaths.map(p => ({ path: p, ...JSON.parse(fs.readFileSync(p, 'utf-8')) }));
  const datasetPath = arg('--dataset') ?? 'calibration-dataset-5y.json';

  if (fs.existsSync(datasetPath)) {
    const ratings = computeDriverRatings(hydrateDataset(JSON.parse(fs.readFileSync(datasetPath, 'utf-8'))));
    saveDriverRatings(ratings);
    console.log(`driver ratings: ${ratings.size}`);
  }

  const info = await fetchV75GameInfo(date, type);
  if (!info) { console.error(`No ${type} on ${date}`); process.exit(1); }
  const races = await fetchRaceDataForGame(date, info, type);

  const records: LegRecord[] = [];
  console.log(`\n${type} ${date} — configs: ${configs.map(c => c.label ?? c.path).join(' | ')}\n`);

  for (const race of races) {
    const winner = await winnerOf(race.raceId);
    if (!winner) continue;

    const hs = (race.horses ?? []).filter((h: any) => h.liveOdds > 0 && h.betDistribution > 0);
    let marketFav = '—';
    let winnerFlag: 'overbet' | 'underbet' | null = null;
    let legFlagged = 0;
    if (hs.length >= 4) {
      const oSum = hs.reduce((s: number, h: any) => s + 1 / h.liveOdds, 0);
      const sSum = hs.reduce((s: number, h: any) => s + h.betDistribution, 0);
      const rows = hs.map((h: any) => ({
        name: String(h.name),
        ratio: ((1 / h.liveOdds) / oSum) / (h.betDistribution / sSum),
        odds: h.liveOdds,
      }));
      marketFav = rows.reduce((a, b) => (a.odds <= b.odds ? a : b)).name;
      const win = rows.find(r => r.name === winner);
      if (win) winnerFlag = win.ratio < 0.8 ? 'overbet' : win.ratio >= 1.25 ? 'underbet' : null;
      legFlagged = rows.filter(r => r.ratio < 0.8).length;
    }

    // Raw km-times are independent of weights, so compute once and score every
    // config against the same inputs -- otherwise the comparison would include
    // fetch-to-fetch variation rather than only the weight difference.
    const raw = await calculateRawKmTimesForRaceWithId(
      race.raceId,
      race.horses.map((h: any) => ({
        horseKey: h.horseKey, horse: { id: h.horseId, name: String(h.name) },
        number: h.startNumber ?? h.postPosition, postPosition: h.postPosition, distance: h.distance,
        driver: { firstName: h.driver.firstName, lastName: h.driver.lastName, statistics: { winPercentage: h.driver.winPercentage } },
      })) as any,
      undefined, date, 'live'
    );

    const picks: Pick[] = [];
    for (const cfg of configs) {
      const res = await RaceResultProcessor.processRaceResult(race, raw, cfg.weights, undefined, cfg.postPositionCurves);
      const top = res.analysisComplete
        ? [...res.horses].sort((a: any, b: any) => (a.rank ?? 99) - (b.rank ?? 99))[0]
        : null;
      const pick = (top as any)?.horseName ?? '—';
      picks.push({ config: cfg.label ?? cfg.path, pick: String(pick), hit: pick === winner });
    }

    const line = picks.map(p => `${p.hit ? '*' : ' '}${p.pick}`.padEnd(24)).join('');
    console.log(`${String(race.raceNumber).padStart(3)}  ${winner.padEnd(22)}  ${line}  mkt:${marketFav}`);

    records.push({
      date, type, raceId: race.raceId, leg: race.raceNumber,
      winner, marketFav, marketHit: marketFav === winner,
      picks, overbetFlagged: legFlagged, winnerFlag,
    });
  }

  appendLog(logPath, records);
  summarise(logPath);
}

main().catch(e => { console.error(e); process.exit(1); });
