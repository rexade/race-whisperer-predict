/**
 * Builds kmTimeRecords.json from Kmtime/* — 16 JS files.
 * Uses the full list: const races = [ { id, name, date, starts: [ { horse, timings }, ... ] }, ... ]
 * We slice from "const races = " to the opening "[", then to end of file, parse as JSON.
 * Run from repo root: node scripts/buildKmTimeData.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const kmtimeDir = path.join(repoRoot, 'Kmtime');
const outPath = path.join(repoRoot, 'public', 'kmTimeRecords.json');

function loadRaces(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const prefix = 'const races = ';
  const idx = raw.indexOf(prefix);
  if (idx === -1) return null;
  const arrayStart = raw.indexOf('[', idx + prefix.length);
  if (arrayStart === -1) return null;
  const json = raw.slice(arrayStart).trimEnd();
  try {
    return JSON.parse(json);
  } catch (e) {
    if (process.env.DEBUG_KM) console.warn('parse fail', filePath, e.message?.slice(0, 60));
    return null;
  }
}

function getStartsFromRaces(races) {
  if (!Array.isArray(races)) return [];
  const out = [];
  for (const race of races) {
    if (!Array.isArray(race?.starts)) continue;
    for (const start of race.starts) {
      out.push({ start, race });
    }
  }
  return out;
}

function slimRecord({ start, race }, dateKey) {
  const horseName = start?.horse?.name;
  const timings = start?.timings ?? {};
  if (!horseName || (timings.first200 == null && timings.last200 == null)) return null;
  return {
    horseName: String(horseName).trim(),
    date: race?.date || dateKey,
    first200: timings.first200 ?? null,
    last200: timings.last200 ?? null,
    best100: timings.best100 ?? null,
    best100start: timings.best100start ?? null,
    best100stop: timings.best100stop ?? null,
    actualDistanceRan: timings.actualDistanceRan ?? null,
    actualKMTime: timings.actualKMTime ?? null,
    slipstreamDistance: timings.slipstreamDistance ?? null,
    raceName: race?.name ?? null,
  };
}

function normalizeHorseName(name) {
  if (typeof name !== 'string') return '';
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseFile(filePath, dateKey) {
  const races = loadRaces(filePath);
  if (!races) return [];
  const starts = getStartsFromRaces(races);
  const records = [];
  for (const item of starts) {
    const rec = slimRecord(item, dateKey);
    if (rec) records.push(rec);
  }
  return records;
}

function main() {
  if (!fs.existsSync(kmtimeDir)) {
    console.warn('Kmtime directory not found.');
    fs.writeFileSync(outPath, JSON.stringify({ byHorse: {}, dates: [] }, null, 0));
    return;
  }
  const byHorse = {};
  const dates = [];
  for (const file of fs.readdirSync(kmtimeDir).sort()) {
    const fullPath = path.join(kmtimeDir, file);
    if (!fs.statSync(fullPath).isFile()) continue;
    const dateKey = /^\d{6}$/.test(file)
      ? `20${file.slice(0, 2)}-${file.slice(2, 4)}-${file.slice(4, 6)}`
      : file;
    dates.push(dateKey);
    const records = parseFile(fullPath, dateKey);
    if (process.env.DEBUG_KM) console.log(file, 'records:', records.length);
    for (const rec of records) {
      const key = normalizeHorseName(rec.horseName);
      if (!key) continue;
      if (!byHorse[key]) byHorse[key] = [];
      byHorse[key].push({ ...rec, fileDate: file });
    }
  }
  for (const k of Object.keys(byHorse)) {
    byHorse[k].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ byHorse, dates: [...new Set(dates)].sort() }, null, 0));
  console.log('Built', outPath, '—', Object.keys(byHorse).length, 'horses,', dates.length, 'dates');
}

main();
