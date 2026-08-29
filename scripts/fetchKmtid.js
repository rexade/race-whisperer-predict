/**
 * Backfills sectional/trip data from kmtid.atgx.se.
 *
 * kmtid publishes one JS bundle per covered meeting at /{yymmdd}/js/races.js.
 * Coverage is by meeting, not by day — roughly one card a week, which lines up
 * with the featured V75/V85 cards this project targets. Days with no bundle
 * return 404 and are simply skipped.
 *
 * The payload carries what a raw km-time cannot: actualDistanceRan (ground
 * actually covered), slipstreamDistance (how much of the trip was spent in
 * cover), sectionals, and a galloped flag. Race ids are `date_trackId_number`,
 * matching ATG's, so the output is keyed `raceId::startNumber` for a direct join.
 *
 * Resumable: each covered date is cached as raw JS under --cache and reused.
 *
 * Usage:
 *   node scripts/fetchKmtid.js [--from 2025-03-01] [--to 2026-08-29]
 *                              [--cache data/kmtid-cache] [--out data/kmtid-records.json]
 */
import fs from 'fs';
import path from 'path';

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : fallback;
};

const from = arg('--from', '2025-03-01');
const to = arg('--to', new Date().toISOString().slice(0, 10));
const cacheDir = arg('--cache', 'data/kmtid-cache');
const outPath = arg('--out', 'data/kmtid-records.json');
const CONCURRENCY = 6;

const yymmdd = d => d.toISOString().slice(2, 10).replace(/-/g, '');

function dateRange(a, b) {
  const out = [];
  for (let d = new Date(a + 'T00:00:00Z'); d <= new Date(b + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(new Date(d));
  }
  return out;
}

/** The bundle is JS, not JSON: slice from `const races = ` to end and parse the array. */
function parseRaces(raw) {
  const prefix = 'const races = ';
  const i = raw.indexOf(prefix);
  if (i === -1) return null;
  const start = raw.indexOf('[', i + prefix.length);
  if (start === -1) return null;
  try {
    return JSON.parse(raw.slice(start).trimEnd().replace(/;$/, ''));
  } catch {
    return null;
  }
}

async function fetchDay(key) {
  const cached = path.join(cacheDir, `${key}.js`);
  if (fs.existsSync(cached)) return fs.readFileSync(cached, 'utf-8');
  const res = await fetch(`https://kmtid.atgx.se/${key}/js/races.js`);
  if (!res.ok) return null;
  const text = await res.text();
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(cached, text);
  return text;
}

async function main() {
  const days = dateRange(from, to).map(yymmdd);
  console.log(`Scanning ${days.length} days: ${from} … ${to}`);

  const byRaceStart = {};
  let covered = 0, races = 0, starts = 0, done = 0;

  const queue = [...days];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const key = queue.shift();
      let raw = null;
      try {
        raw = await fetchDay(key);
      } catch (err) {
        console.warn(`  ${key}: fetch failed (${err.message})`);
      }
      done++;
      if (!raw) continue;
      const parsed = parseRaces(raw);
      if (!parsed) { console.warn(`  ${key}: unparseable bundle`); continue; }

      covered++;
      for (const race of parsed) {
        if (!race?.id || !Array.isArray(race.starts)) continue;
        races++;
        for (const s of race.starts) {
          const t = s?.timings;
          if (!t || s.number == null) continue;
          starts++;
          byRaceStart[`${race.id}::${s.number}`] = {
            raceId: race.id,
            date: race.date,
            trackId: race.trackId,
            raceNumber: race.number,
            raceDistance: race.distance,
            startMethod: race.startMethod,
            startNumber: s.number,
            horseName: s.horse?.name ?? null,
            driverName: s.driver?.name ?? null,
            result: s.result ?? null,
            galloped: s.galloped === true,
            horseDistance: s.distance ?? null,
            actualDistanceRan: t.actualDistanceRan ?? null,
            actualKMTime: t.actualKMTime ?? null,
            slipstreamDistance: t.slipstreamDistance ?? null,
            first200ms: t.first200ms ?? null,
            last200ms: t.last200ms ?? null,
            best100ms: t.best100ms ?? null,
          };
        }
      }
      if (done % 50 === 0) console.log(`  [${done}/${days.length}] covered=${covered} races=${races} starts=${starts}`);
    }
  });
  await Promise.all(workers);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ byRaceStart }, null, 0));
  console.log(`\nDone. covered days=${covered}  races=${races}  starts=${starts}`);
  console.log(`Wrote ${outPath}`);
}

main().catch(err => { console.error(err); process.exit(1); });
