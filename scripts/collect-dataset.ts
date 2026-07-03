/**
 * Historical dataset collector — Node CLI.
 *
 * Walks the ATG calendar over a date range, collects completed races for the
 * requested game types (V75/V85/V86/GS75/…), fetches per-horse km-time history,
 * and writes a CalibrationDataset JSON compatible with kfold-multistart.ts,
 * eval-holdout.ts, and the browser calibration panel.
 *
 * Reuses the app's own pipeline (fetchRaceDataForGame → extractHorseData,
 * V75ResultsFetcher, calculateRawKmTimesForRaceWithId) so horse keys, field
 * shapes, and leakage cutoffs are identical to the browser dataset — including
 * the new shoes.changed / liveOdds / betDistribution capture fields.
 *
 * Resumable: each date is cached in --cache as its own JSON; re-running skips
 * completed dates. Assembly into the final --out file happens at the end
 * (or standalone via --assemble-only).
 *
 * Usage:
 *   npx tsx scripts/collect-dataset.ts [options]
 *     --months <n>      collect n months back from yesterday (default 18)
 *     --from / --to     explicit ISO date range (overrides --months)
 *     --types <csv>     game types (default V75,V85,V86,GS75)
 *     --out <file>      final dataset path (default calibration-dataset-full.json)
 *     --cache <dir>     per-date cache dir (default data/collect-cache)
 *     --delay <ms>      pause between races (default 250)
 *     --assemble-only   skip collection, just rebuild --out from cache
 */

import './node-polyfills';
import * as fs from 'fs';
import * as path from 'path';

// ── Fetch shim: map the app's relative /api/atg/* to the real ATG API ────────
const ATG_BASE = 'https://www.atg.se/services/racinginfo/v1/api';
const realFetch = globalThis.fetch.bind(globalThis);
(globalThis as any).fetch = (input: any, init?: any) => {
  if (typeof input === 'string' && input.startsWith('/api/atg/')) {
    input = ATG_BASE + input.slice('/api/atg'.length);
  }
  return realFetch(input, init);
};

// Imports that use fetch come after the shim (they call fetch lazily, but
// keeping the order makes the dependency explicit).
import { fetchRaceDataForGame, V75GameInfo } from '../src/services/v75CalendarApi';
import { V75ResultsFetcher } from '../src/components/v75/services/v75ResultsFetcher';
import { calculateRawKmTimesForRaceWithId } from '../src/services/kmTimeProcessor';
import { makeHorseKey, horseKeyFromRawTime, horseKeyFromRaceHorse } from '../src/services/horseIdentity';
import type { GameType } from '../src/config/game';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

interface SerializedRace {
  raceId: string;
  raceNumber: number;
  raceData: any;
  rawKmTimes: any[];
  /** horseKey → { position, kmTime?, finalOdds? } as a plain object (JSON-safe). */
  actualResults: Record<string, any>;
}

interface SerializedDate { date: string; races: SerializedRace[] }

async function collectDate(date: string, types: string[], delayMs: number): Promise<SerializedDate | null> {
  const calResp = await fetch(`/api/atg/calendar/day/${date}`);
  if (!calResp.ok) throw new Error(`calendar ${date}: HTTP ${calResp.status}`);
  const cal = await calResp.json();

  const races: SerializedRace[] = [];
  const seenRaceIds = new Set<string>();

  for (const type of types) {
    const games: any[] = cal.games?.[type] ?? [];
    for (const g of games) {
      if (g.status !== 'results') continue; // only completed games have outcomes

      const gameInfo: V75GameInfo = {
        gameId: g.id,
        raceIds: g.races ?? [],
        startTime: g.startTime ?? '',
        jackpotAmount: 0,
        track: '',
      };
      if (gameInfo.raceIds.length === 0) continue;

      const raceDataList = await fetchRaceDataForGame(date, gameInfo, type as GameType);

      // Market signals (vinnare odds, betDistribution) only exist in the game
      // payload — the per-race endpoint has no pools. Fetch the game once and
      // merge into the extracted horses by (raceId, postPosition).
      try {
        const gameResp = await fetch(`/api/atg/games/${g.id}`);
        if (gameResp.ok) {
          const game = await gameResp.json();
          const poolsByRace = new Map<string, Map<number, { liveOdds?: number; betDistribution?: number }>>();
          for (const gr of game.races ?? []) {
            const byPos = new Map<number, { liveOdds?: number; betDistribution?: number }>();
            for (const st of gr.starts ?? []) {
              const rawOdds = st.pools?.vinnare?.odds;
              const marking = Object.values(st.pools ?? {}).find((p: any) => p && typeof p.betDistribution === 'number') as any;
              byPos.set(st.number ?? st.postPosition, {
                liveOdds: typeof rawOdds === 'number' && rawOdds > 0 ? rawOdds / 100 : undefined,
                betDistribution: marking ? marking.betDistribution / 100 : undefined,
              });
            }
            poolsByRace.set(gr.id, byPos);
          }
          for (const race of raceDataList) {
            const byPos = poolsByRace.get(race.raceId);
            if (!byPos) continue;
            for (const horse of race.horses) {
              const p = byPos.get(horse.postPosition);
              if (p) { horse.liveOdds = p.liveOdds; horse.betDistribution = p.betDistribution; }
            }
          }
        }
      } catch {
        // Market data is enrichment — races remain usable without it
      }

      let actualResults: any[] = [];
      try {
        actualResults = await V75ResultsFetcher.fetchActualResults(date, gameInfo);
      } catch {
        continue;
      }
      if (actualResults.length === 0) continue;

      for (const race of raceDataList) {
        if (seenRaceIds.has(race.raceId)) continue; // race shared between game types

        const actualRace = actualResults.find(ar => ar.raceId === race.raceId);
        if (!actualRace?.finishOrder?.length) continue;

        const actualMap: Record<string, any> = {};
        for (const finish of actualRace.finishOrder) {
          // Positions above field size are ATG special codes (disqualified etc.)
          if (finish.position > 0 && finish.position <= 20) {
            const horseKey = finish.horseKey ?? makeHorseKey(race.raceId, finish.horseId, finish.postPosition);
            actualMap[horseKey] = {
              position: finish.position,
              kmTime: finish.kmTime ?? undefined,
              finalOdds: finish.finalOdds != null && Number.isFinite(finish.finalOdds) ? finish.finalOdds : undefined,
            };
          }
        }
        if (Object.keys(actualMap).length === 0) continue;

        const atgStarts = race.horses.map((horse: any) => ({
          horseKey: horse.horseKey,
          horse: { id: horse.horseId, name: typeof horse.name === 'string' ? horse.name : String(horse.name) },
          number: horse.postPosition,
          postPosition: horse.postPosition,
          distance: horse.distance,
          driver: {
            firstName: horse.driver.firstName,
            lastName: horse.driver.lastName,
            statistics: { winPercentage: horse.driver.winPercentage },
          },
        }));

        let rawKmTimes: any[] = [];
        try {
          rawKmTimes = await calculateRawKmTimesForRaceWithId(race.raceId, atgStarts as any, undefined, date);
        } catch {
          rawKmTimes = []; // race still contributes via statistical fallback
        }

        seenRaceIds.add(race.raceId);
        races.push({
          raceId: race.raceId,
          raceNumber: race.raceNumber,
          raceData: race,
          rawKmTimes,
          actualResults: actualMap,
        });

        await sleep(delayMs);
      }
    }
  }

  return races.length > 0 ? { date, races } : null;
}

function assemble(cacheDir: string, outPath: string): void {
  const files = fs.readdirSync(cacheDir).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  const dataset: SerializedDate[] = [];
  for (const f of files) {
    const entry = JSON.parse(fs.readFileSync(path.join(cacheDir, f), 'utf-8'));
    if (entry && entry.races?.length > 0) dataset.push(entry);
  }
  const races = dataset.reduce((s, d) => s + d.races.length, 0);
  fs.writeFileSync(outPath, JSON.stringify(dataset));
  console.log(`\nAssembled ${outPath}: ${dataset.length} dates, ${races} races`);
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('Usage: npx tsx scripts/collect-dataset.ts [--months 18] [--from YYYY-MM-DD --to YYYY-MM-DD] [--types V75,V85,V86,GS75] [--out file.json] [--cache dir] [--delay 250] [--assemble-only]');
    return;
  }

  const months = Number(argValue('--months') ?? 18);
  const to = argValue('--to') ?? isoDaysAgo(1);
  const from = argValue('--from') ?? (() => {
    const d = new Date(to);
    d.setMonth(d.getMonth() - months);
    return d.toISOString().split('T')[0];
  })();
  const types = (argValue('--types') ?? 'V75,V85,V86,GS75').split(',').map(s => s.trim());
  const outPath = argValue('--out') ?? 'calibration-dataset-full.json';
  const cacheDir = argValue('--cache') ?? 'data/collect-cache';
  const delayMs = Number(argValue('--delay') ?? 250);

  fs.mkdirSync(cacheDir, { recursive: true });

  if (process.argv.includes('--assemble-only')) {
    assemble(cacheDir, outPath);
    return;
  }

  // Build date list (ascending — stable resume order)
  const dates: string[] = [];
  for (const d = new Date(from); d.toISOString().split('T')[0] <= to; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }

  console.log(`Collecting ${from} … ${to} (${dates.length} days) · types: ${types.join(',')}`);
  console.log(`Cache: ${cacheDir} · output: ${outPath}\n`);

  let collected = 0, skipped = 0, empty = 0, failed = 0, totalRaces = 0;
  const t0 = Date.now();

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    const cachePath = path.join(cacheDir, `${date}.json`);
    if (fs.existsSync(cachePath)) { skipped++; continue; }

    try {
      const entry = await collectDate(date, types, delayMs);
      if (entry) {
        fs.writeFileSync(cachePath, JSON.stringify(entry));
        collected++;
        totalRaces += entry.races.length;
        const elapsed = (Date.now() - t0) / 1000;
        console.log(`[${i + 1}/${dates.length}] ${date}: ${entry.races.length} races (total ${totalRaces} races, ${Math.round(elapsed)}s elapsed)`);
      } else {
        // Cache empties too so re-runs skip no-game days instantly
        fs.writeFileSync(cachePath, JSON.stringify({ date, races: [] }));
        empty++;
      }
    } catch (err) {
      failed++;
      console.warn(`[${i + 1}/${dates.length}] ${date}: FAILED — ${err instanceof Error ? err.message : err}`);
      await sleep(3000); // back off after failures (rate limit / network)
    }

    await sleep(delayMs);
  }

  console.log(`\nDone. collected=${collected} skipped=${skipped} empty=${empty} failed=${failed}`);
  if (failed > 0) console.log('Re-run the same command to retry failed dates (successes are cached).');

  assemble(cacheDir, outPath);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
