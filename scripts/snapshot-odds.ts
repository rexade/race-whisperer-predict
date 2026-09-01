/**
 * Capture an odds snapshot for an upcoming card.
 *
 * Odds DRIFT — how a price moves as post time approaches — is information the
 * final price does not contain. A horse shortening from 12 to 7 in the last hour
 * is being backed by money that arrived late, and late money is generally
 * better informed than early money. Whether that predicts anything in Swedish
 * trotting is untested here.
 *
 * It cannot be tested backwards. The collected dataset holds exactly one odds
 * value per horse, captured whenever the collector happened to run, and ATG's
 * API returns only current odds with no history or timestamps. The series has to
 * be built going forward, which is what this does.
 *
 * Run it several times before a card — the useful shape is one snapshot a day
 * ahead and one close to post, with a couple in between:
 *
 *   npx tsx scripts/snapshot-odds.ts --date 2026-09-05 --type V85
 *
 * Each run appends one row per horse to data/odds-snapshots.jsonl, carrying the
 * minutes remaining until that leg starts. Nothing analyses it yet; that needs
 * a dozen cards of history first. Snapshots are cheap and unrepeatable — a card
 * you did not capture is gone — so capture generously and decide later.
 */
import './node-polyfills';
import * as fs from 'fs';

const ATG = 'https://www.atg.se/services/racinginfo/v1/api';
const realFetch = globalThis.fetch.bind(globalThis);
(globalThis as any).fetch = (i: any, o?: any) =>
  realFetch(typeof i === 'string' && i.startsWith('/api/atg/') ? ATG + i.slice('/api/atg'.length) : i, o);

import { fetchV75GameInfo, fetchRaceDataForGame } from '../src/services/v75CalendarApi';
import type { GameType } from '../src/config/game';

const arg = (f: string) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : undefined; };

interface Row {
  capturedAt: string;
  date: string;
  type: string;
  raceId: string;
  leg: number;
  startTime: string | null;
  /** Minutes from capture to this leg's start. Negative once it has run. */
  minutesToPost: number | null;
  startNumber: number;
  horseName: string;
  odds: number | null;
  betDistribution: number | null;
}

async function raceStartTimes(raceIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const id of raceIds) {
    try {
      const r = await realFetch(`${ATG}/races/${id}`);
      if (!r.ok) continue;
      const d: any = await r.json();
      if (d?.startTime) out.set(id, d.startTime);
    } catch { /* a missing start time only costs the minutesToPost column */ }
  }
  return out;
}

async function main() {
  const date = arg('--date') ?? new Date().toISOString().split('T')[0];
  const type = (arg('--type') ?? 'V85') as GameType;
  const out = arg('--out') ?? 'data/odds-snapshots.jsonl';

  const info = await fetchV75GameInfo(date, type);
  if (!info) { console.error(`No ${type} game on ${date}`); process.exit(1); }
  const races = await fetchRaceDataForGame(date, info, type);
  const starts = await raceStartTimes(races.map((r: any) => r.raceId));

  const capturedAt = new Date().toISOString();
  const now = Date.now();
  const rows: Row[] = [];
  let withOdds = 0;

  for (const race of races as any[]) {
    const startTime = starts.get(race.raceId) ?? null;
    const minutesToPost = startTime ? Math.round((new Date(startTime).getTime() - now) / 60000) : null;
    for (const h of race.horses ?? []) {
      const odds = typeof h.liveOdds === 'number' && h.liveOdds > 0 ? h.liveOdds : null;
      if (odds !== null) withOdds++;
      rows.push({
        capturedAt, date, type,
        raceId: race.raceId,
        leg: race.raceNumber,
        startTime,
        minutesToPost,
        startNumber: h.startNumber ?? h.postPosition,
        horseName: String(h.name),
        odds,
        betDistribution: typeof h.betDistribution === 'number' ? h.betDistribution : null,
      });
    }
  }

  fs.mkdirSync(out.replace(/[^/\\]+$/, '') || '.', { recursive: true });
  fs.appendFileSync(out, rows.map(r => JSON.stringify(r)).join('\n') + '\n');

  const mins = rows.map(r => r.minutesToPost).filter((v): v is number => v !== null);
  const window = mins.length ? `${Math.min(...mins)}..${Math.max(...mins)} min to post` : 'start times unavailable';
  console.log(`${capturedAt}  ${type} ${date}`);
  console.log(`  ${rows.length} horses across ${races.length} legs, ${withOdds} with live odds (${window})`);
  console.log(`  appended to ${out}`);

  if (withOdds === 0) {
    console.log('\n  No live odds yet — the win pool usually opens on raceday. An empty');
    console.log('  early snapshot still records that the pool was closed, which is itself');
    console.log('  the baseline the first priced snapshot moves away from.');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
