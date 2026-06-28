import fs from 'fs';
import { collectHorseRecordCandidates, isAggregateRecordSource } from '../src/services/utils/recordsFallback';
import { normalizeKmTimeForHistory } from '../src/services/utils/kmTimeNormalization';
import { toSeconds } from '../src/services/utils/robustTimeConversion';

const raceId = process.argv[2] ?? '2026-05-09_6_5';
const horseName = process.argv[3] ?? 'Pure Athena';
const date = process.argv[4] ?? '2026-05-09';

const cache = JSON.parse(fs.readFileSync('reports/rawtime-weighted-source-cache.json', 'utf8'));
const sourceRace = Object.values<any>(cache.dates)
  .flatMap((d: any) => d.races ?? [])
  .find((r: any) => r.raceId === raceId);
if (!sourceRace) throw new Error(`Race not found: ${raceId}`);
const start = sourceRace.starts.find((s: any) => String(s.horse?.name).toLowerCase() === horseName.toLowerCase());
if (!start) throw new Error(`Horse not found: ${horseName}`);

const cutoff = new Date(date);
cutoff.setMonth(cutoff.getMonth() - 5);
const upper = new Date(date);

function numeric(t: any): boolean {
  return t && typeof t.minutes === 'number' && typeof t.seconds === 'number';
}

function normalize(record: any) {
  const distance = record.start?.distance ?? (record.meta?.distance === 'short' ? 1640 : record.meta?.distance === 'long' ? 2640 : 2140);
  const method = record.race?.startMethod ?? record.meta?.startMethod ?? 'auto';
  const n = normalizeKmTimeForHistory(record.kmTime, distance, method);
  return { time: n, sec: toSeconds(n.minutes, n.seconds, n.tenths ?? 0) };
}

const resultRecords = (start.records ?? []).map((r: any) => ({ ...r, meta: { ...(r.meta ?? {}), source: 'results' } }));
const mixedRecords = collectHorseRecordCandidates(start.horse).records;

for (const [label, records] of [['results', resultRecords], ['mixed', mixedRecords]] as const) {
  const valid = records
    .filter((r: any) => {
      if (!numeric(r.kmTime) || r.galloped || r.disqualified) return false;
      if (!r.date && isAggregateRecordSource(r.meta?.source)) return true;
      if (!r.date) return false;
      const d = new Date(r.date);
      return d >= cutoff && d < upper;
    })
    .map((r: any) => {
      const n = normalize(r);
      return {
        source: r.meta?.source ?? 'results',
        date: r.date ?? '(undated)',
        raceId: r.race?.id,
        raw: `${r.kmTime.minutes}:${String(r.kmTime.seconds).padStart(2, '0')}.${r.kmTime.tenths ?? 0}`,
        normalized: `${n.time.minutes}:${String(n.time.seconds).padStart(2, '0')}.${n.time.tenths ?? 0}`,
        sec: n.sec,
        distance: r.start?.distance ?? r.meta?.distance,
        method: r.race?.startMethod ?? r.meta?.startMethod,
        place: r.place,
      };
    })
    .sort((a: any, b: any) => a.sec - b.sec);
  console.log(`\n${label} valid=${valid.length}`);
  console.table(valid);
  for (const n of [1, 2, 3]) {
    const slice = valid.slice(0, n);
    if (!slice.length) continue;
    const avg = slice.reduce((s: number, r: any) => s + r.sec, 0) / slice.length;
    console.log(`${label} top${n} avg=${avg.toFixed(1)}`);
  }
}
