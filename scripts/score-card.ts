/**
 * Score a finished card: model pick, market favourite, and pool-value flags
 * against what actually won.
 *
 * One card is far too small to conclude anything, so every leg is appended to a
 * JSONL log keyed by raceId and re-running a date replaces rather than
 * duplicates it. Accumulated over weeks that log becomes the forward test --
 * the only honest way left to check whether the holdout edge is real, since the
 * config is frozen and every future card is genuinely out of sample. Re-tuning
 * against these results would destroy exactly the property that makes them
 * worth collecting.
 *
 *   npx tsx scripts/score-card.ts --date 2026-09-05 --type V85
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

interface LegRecord {
  date: string; type: string; raceId: string; leg: number; config: string;
  winner: string; modelPick: string; marketFav: string;
  modelHit: boolean; marketHit: boolean;
  overbetFlagged: number; winnerFlag: 'overbet' | 'underbet' | null;
}

function appendLog(logPath: string, records: LegRecord[]): void {
  const existing: LegRecord[] = fs.existsSync(logPath)
    ? fs.readFileSync(logPath, 'utf-8').split('\n').filter(Boolean).map(l => JSON.parse(l))
    : [];
  // Re-running a date should correct it, not double-count it.
  const incoming = new Set(records.map(r => r.raceId));
  const merged = [...existing.filter(r => !incoming.has(r.raceId)), ...records];
  merged.sort((a, b) => (a.date + a.raceId).localeCompare(b.date + b.raceId));
  fs.mkdirSync(logPath.replace(/[^/\\]+$/, '') || '.', { recursive: true });
  fs.writeFileSync(logPath, merged.map(r => JSON.stringify(r)).join('\n') + '\n');
}

function summarise(logPath: string): void {
  if (!fs.existsSync(logPath)) { console.log(`No forward-test log at ${logPath} yet.`); return; }
  const rows: LegRecord[] = fs.readFileSync(logPath, 'utf-8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  if (rows.length === 0) { console.log('Log is empty.'); return; }

  const dates = [...new Set(rows.map(r => r.date))].sort();
  const model = rows.filter(r => r.modelHit).length;
  const market = rows.filter(r => r.marketHit).length;
  const flagged = rows.reduce((s, r) => s + r.overbetFlagged, 0);
  const overbetWins = rows.filter(r => r.winnerFlag === 'overbet').length;
  const underbetWins = rows.filter(r => r.winnerFlag === 'underbet').length;
  const pct = (n: number, d: number) => d ? `${(n / d * 100).toFixed(1)}%` : 'n/a';

  console.log(`\nForward test — ${dates.length} card(s), ${rows.length} legs (${dates[0]} … ${dates[dates.length - 1]})\n`);
  console.log(`  model            ${String(model).padStart(4)}/${rows.length}   ${pct(model, rows.length)}`);
  console.log(`  market favourite ${String(market).padStart(4)}/${rows.length}   ${pct(market, rows.length)}`);
  console.log(`  edge             ${((model - market) / rows.length * 100).toFixed(1)}pp\n`);
  console.log(`  horses flagged OVERBET: ${flagged}, of which won: ${overbetWins} (${pct(overbetWins, flagged)})`);
  console.log(`  legs won by an UNDERBET horse: ${underbetWins}/${rows.length}`);
  // 604-race holdout put the model at 39.1% and the market at 36.9%; the
  // 5-year pool study put overbet horses at roughly 13-15%. Those are the
  // numbers these lines are being checked against.
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
  const cfgPath = arg('--config') ?? 'data/cfg-full-refit.json';
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
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
  let modelHit = 0, marketHit = 0, legs = 0, overbetWon = 0, underbetWon = 0, fadeFlagged = 0;
  console.log(`\n${type} ${date} — config: ${cfg.label ?? cfgPath}\n`);
  console.log('leg  winner                    model pick               market fav               flag');
  console.log('------------------------------------------------------------------------------------------');

  for (const race of races) {
    const winner = await winnerOf(race.raceId);
    if (!winner) continue;
    legs++;

    const hs = (race.horses ?? []).filter((h: any) => h.liveOdds > 0 && h.betDistribution > 0);
    let marketFav = '—', flag = '';
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
      if (win) {
        if (win.ratio < 0.8) { flag = 'OVERBET won'; overbetWon++; winnerFlag = 'overbet'; }
        else if (win.ratio >= 1.25) { flag = 'UNDERBET won'; underbetWon++; winnerFlag = 'underbet'; }
      }
      legFlagged = rows.filter(r => r.ratio < 0.8).length;
      fadeFlagged += legFlagged;
    }
    if (marketFav === winner) marketHit++;

    const raw = await calculateRawKmTimesForRaceWithId(
      race.raceId,
      race.horses.map((h: any) => ({
        horseKey: h.horseKey, horse: { id: h.horseId, name: String(h.name) },
        number: h.startNumber ?? h.postPosition, postPosition: h.postPosition, distance: h.distance,
        driver: { firstName: h.driver.firstName, lastName: h.driver.lastName, statistics: { winPercentage: h.driver.winPercentage } },
      })) as any,
      undefined, date, 'live'
    );
    const res = await RaceResultProcessor.processRaceResult(race, raw, cfg.weights, undefined, cfg.postPositionCurves);
    const pick = res.analysisComplete
      ? [...res.horses].sort((a: any, b: any) => (a.rank ?? 99) - (b.rank ?? 99))[0]
      : null;
    const pickName = (pick as any)?.horseName ?? '—';
    if (pickName === winner) modelHit++;

    console.log(`${String(race.raceNumber).padStart(3)}  ${winner.padEnd(24)}  ${String(pickName).padEnd(22)}  ${marketFav.padEnd(22)}  ${flag}`);

    records.push({
      date, type, raceId: race.raceId, leg: race.raceNumber, config: cfg.label ?? cfgPath,
      winner, modelPick: String(pickName), marketFav,
      modelHit: pickName === winner, marketHit: marketFav === winner,
      overbetFlagged: legFlagged, winnerFlag,
    });
  }

  appendLog(logPath, records);

  console.log('------------------------------------------------------------------------------------------');
  console.log(`legs ${legs}   model ${modelHit}/${legs}   market favourite ${marketHit}/${legs}`);
  console.log(`winners that were flagged OVERBET (should be rare): ${overbetWon}`);
  console.log(`winners that were flagged UNDERBET: ${underbetWon}`);
  console.log(`total horses flagged OVERBET across the card: ${fadeFlagged}`);
}

main().catch(e => { console.error(e); process.exit(1); });
