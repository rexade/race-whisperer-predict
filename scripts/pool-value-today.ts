/**
 * Apply the pool-value ratio to an upcoming card.
 *
 * ratio = normalised odds-implied probability / normalised pool share.
 * Above 1 the crowd is under-including the horse relative to its price;
 * below ~0.8 you are overpaying for ticket space. Uses only market data.
 */
import './node-polyfills';
const ATG_BASE = 'https://www.atg.se/services/racinginfo/v1/api';
const realFetch = globalThis.fetch.bind(globalThis);
(globalThis as any).fetch = (input: any, init?: any) =>
  realFetch(typeof input === 'string' && input.startsWith('/api/atg/') ? ATG_BASE + input.slice('/api/atg'.length) : input, init);

import { fetchV75GameInfo, fetchRaceDataForGame } from '../src/services/v75CalendarApi';
import type { GameType } from '../src/config/game';

const argValue = (f: string) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : undefined; };

async function main() {
  const date = argValue('--date') ?? new Date().toISOString().split('T')[0];
  const type = (argValue('--type') ?? 'V85') as GameType;
  const info = await fetchV75GameInfo(date, type);
  if (!info) { console.error(`No ${type} on ${date}`); process.exit(1); }
  const races = await fetchRaceDataForGame(date, info, type);

  for (const race of races) {
    const hs = (race.horses ?? []).filter((h: any) => h.liveOdds > 0 && h.betDistribution > 0);
    if (hs.length < 4) { console.log(`\n── Race ${race.raceNumber}: incomplete market data ──`); continue; }
    const oSum = hs.reduce((s: number, h: any) => s + 1 / h.liveOdds, 0);
    const sSum = hs.reduce((s: number, h: any) => s + h.betDistribution, 0);
    const rows = hs.map((h: any) => {
      const pO = (1 / h.liveOdds) / oSum, pS = h.betDistribution / sSum;
      return { n: h.startNumber ?? h.postPosition, name: String(h.name), odds: h.liveOdds, spel: h.betDistribution, ratio: pO / pS };
    }).sort((a, b) => b.ratio - a.ratio);

    console.log(`\n── Race ${race.raceNumber} · ${race.distance}m ${race.startMethod} ──`);
    for (const r of rows) {
      const tag = r.ratio >= 1.25 ? ' UNDERBET' : r.ratio < 0.8 ? ' OVERBET' : '';
      console.log(`  #${String(r.n).padStart(2)} ${r.name.padEnd(24)} odds ${String(r.odds).padStart(6)}  spel ${r.spel.toFixed(1).padStart(5)}%  ratio ${r.ratio.toFixed(2).padStart(5)}${tag}`);
    }
  }
}
main().catch(e => { console.error(e); process.exit(1); });
