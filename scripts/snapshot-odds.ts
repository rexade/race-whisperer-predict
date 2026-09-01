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
 * Two modes:
 *
 *   npx tsx scripts/snapshot-odds.ts --date 2026-09-05 --type V85   one card
 *   npx tsx scripts/snapshot-odds.ts --auto                          scheduled
 *
 * --auto scans the calendar for today and tomorrow, snapshots every V75/V85/V86
 * card it finds, and skips cards that have already run. It takes no arguments
 * so a scheduler can run it blind.
 *
 * Captures run from ~25h before the card's betting deadline until the deadline
 * itself, and stop there. For a V85/V86 the whole ticket must be in before the
 * FIRST leg runs, so odds after that are unbettable however much they move.
 * Recording is continuous rather than at two chosen moments, because WHICH two
 * readings to compare is the open question and cannot be answered from hours
 * that were never stored.
 *
 * .github/workflows/snapshot-odds.yml runs --auto hourly through Swedish race
 * hours and commits the result, so capture does not depend on any one machine
 * being awake. scripts/snapshot-odds.cmd is the local fallback (Windows Task
 * Scheduler). Vercel cannot host this: that deploy is static and a serverless
 * filesystem is ephemeral, so there is nothing there to append to.
 *
 * Each run appends one row per horse to data/odds-snapshots.jsonl, carrying the
 * minutes remaining until that leg starts. Nothing analyses it yet; that needs
 * a dozen cards of history first. Snapshots are cheap and unrepeatable — a card
 * you did not capture is gone — so capture generously and decide later.
 */
import './node-polyfills';
import * as fs from 'fs';
import * as path from 'path';

const ATG = 'https://www.atg.se/services/racinginfo/v1/api';
const realFetch = globalThis.fetch.bind(globalThis);
(globalThis as any).fetch = (i: any, o?: any) =>
  realFetch(typeof i === 'string' && i.startsWith('/api/atg/') ? ATG + i.slice('/api/atg'.length) : i, o);

import { fetchV75GameInfo, fetchRaceDataForGame } from '../src/services/v75CalendarApi';
import { isRealPrice, isWorthRecording } from '../src/services/analysis/oddsDrift';
import type { GameType } from '../src/config/game';

const arg = (f: string) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : undefined; };

interface Row {
  capturedAt: string;
  date: string;
  type: string;
  raceId: string;
  leg: number;
  startTime: string | null;
  /** Minutes from capture to the betting deadline (the card's FIRST leg). */
  minutesToDeadline: number | null;
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
    } catch { /* a missing start time only costs the deadline clock */ }
  }
  return out;
}

/** Snapshot one card. Returns rows appended, or null when absent/already run. */
async function snapshotCard(date: string, type: GameType, out: string): Promise<number | null> {
  const info = await fetchV75GameInfo(date, type);
  if (!info) return null;
  const races = await fetchRaceDataForGame(date, info, type);
  const starts = await raceStartTimes(races.map((r: any) => r.raceId));

  const capturedAt = new Date().toISOString();
  const now = Date.now();

  // The whole ticket must be in before the FIRST leg runs, so that is the
  // betting deadline for every leg on the card. Odds keep moving through the
  // rest of the afternoon, but nothing can be staked on them by then, and
  // storing that movement would put unbettable information in the dataset.
  const times = races
    .map((r: any) => starts.get(r.raceId))
    .filter((t): t is string => Boolean(t))
    .map(t => new Date(t).getTime());
  const minutesToDeadline = times.length ? Math.round((Math.min(...times) - now) / 60000) : null;

  if (!isWorthRecording(minutesToDeadline)) {
    const why = minutesToDeadline === null ? 'no start times'
      : minutesToDeadline < 0 ? 'betting closed'
      : `${minutesToDeadline} min out, too early`;
    console.log(`${capturedAt}  ${type} ${date}  — ${why}, skipped`);
    return null;
  }

  const rows: Row[] = [];
  let withOdds = 0;
  for (const race of races as any[]) {
    for (const h of race.horses ?? []) {
      const odds = isRealPrice(typeof h.liveOdds === 'number' ? h.liveOdds : null) ? h.liveOdds : null;
      if (odds !== null) withOdds++;
      rows.push({
        capturedAt, date, type,
        raceId: race.raceId,
        leg: race.raceNumber,
        startTime: starts.get(race.raceId) ?? null,
        minutesToDeadline,
        startNumber: h.startNumber ?? h.postPosition,
        horseName: String(h.name),
        odds,
        betDistribution: typeof h.betDistribution === 'number' ? h.betDistribution : null,
      });
    }
  }

  fs.mkdirSync(path.dirname(out) || '.', { recursive: true });
  fs.appendFileSync(out, rows.map(r => JSON.stringify(r)).join('\n') + '\n');

  console.log(`${capturedAt}  ${type} ${date}`);
  console.log(`  ${rows.length} horses across ${races.length} legs, ${withOdds} with live odds`
    + ` (${minutesToDeadline} min to deadline)`);
  return rows.length;
}

async function main() {
  const out = arg('--out') ?? 'data/odds-snapshots.jsonl';

  if (!process.argv.includes('--auto')) {
    const date = arg('--date') ?? new Date().toISOString().split('T')[0];
    const type = (arg('--type') ?? 'V85') as GameType;
    const n = await snapshotCard(date, type, out);
    if (n === null) { console.error(`No ${type} game on ${date} (or already run)`); process.exit(1); }
    return;
  }

  // Scheduled mode: no arguments, so the scheduler stays dumb and this stays in
  // charge of what a card is. Today through +3 days covers the day-ahead
  // snapshots the drift question needs.
  // V85 and V86 only: those are the cards the verdict is about.
  const types = ['V85', 'V86'] as GameType[];
  let captured = 0;
  for (let ahead = 0; ahead <= 1; ahead++) {
    const d = new Date(Date.now() + ahead * 86400000).toISOString().split('T')[0];
    for (const t of types) {
      try {
        const n = await snapshotCard(d, t, out);
        if (n !== null) captured++;
      } catch (e: any) {
        // One broken card must not stop the sweep — the whole point of the
        // schedule is that missed captures are unrecoverable.
        console.error(`  ${t} ${d}: ${e?.message ?? e}`);
      }
    }
  }
  console.log(`--auto done: ${captured} card(s) captured`);
}

main().catch(e => { console.error(e); process.exit(1); });
