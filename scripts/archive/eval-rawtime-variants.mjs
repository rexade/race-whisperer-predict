#!/usr/bin/env node
// Fetch raw ATG start histories once, then compare raw-time filtering/top-N variants.
//
// Usage:
//   node scripts/eval-rawtime-variants.mjs 2026-05-09 2026-05-02
//
// Output:
//   reports/rawtime-variant-cache.json       fetched, unfiltered race/start records
//   reports/rawtime-variant-eval-<date>.json variant metrics

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const REPORTS = join(ROOT, 'reports');
const ATG_BASE = 'https://www.atg.se/services/racinginfo/v1/api';
const CACHE_FILE = join(REPORTS, 'rawtime-variant-cache.json');

const REFERENCE_DIST = 2140;
const SHORTER_RATE = 3.2;
const LONGER_RATE = 2.0;
const DIST_TOLERANCE = 10;
const VOLTE_ADV_S = 1.0;

const FORM_MAX_RACES = 5;
const FORM_GALLOP_PL = 15;
const FORM_FALLBACK_BASELINE_PCT = 10;
const FORM_FALLBACK_SCALE_S = 0.01;
const FORM_SCALE_S = 0.40;
const LAYOFF_THRESH = 14;
const LAYOFF_SCALE_D = 30;
const LAYOFF_MAX_S = 0.35;
const CONSISTENCY_MAX = 0.15;
const CONSISTENCY_SC = 3.0;
const ODDS_NEUTRAL = 8;
const ODDS_SCALE = 6;
const ODDS_MAX_S = 0.30;
const DRIVER_BASELINE = 0.12;
const DRIVER_SCALE = 0.10;
const DRIVER_CAP_S = 0.30;
const SP_FIELD_MAX_IMPACT_S = 0.25;
const SP_FIELD_BETA = 2.0;
const SP_FIELD_MIN_SIZE = 3;
const SP_FINAL_CAP_S = 0.30;

// V37 from presetWeights.ts, used because existing raw-time reports were V37-based.
const WEIGHTS = {
  postPosition: 1.108,
  driverPerformance: 1.433,
  form: 2.364,
  startPoints: 1.661,
  placePercentage: 0.919,
  horseWinPercentage: 1.579,
  earningsPerStart: 1.489,
  gallopRisk: 0,
  layoffPenalty: 1.166,
  consistencyFactor: 2.240,
  oddsHistorical: 0.134,
  volteStartDistancePenalty: 1.260,
  sulkyType: 0,
};

const POST_CURVE_AUTO = {
  1: -0.138, 2: -0.075, 3: -0.150, 4: -0.250, 5: -0.025,
  6: -0.050, 7: 0.300, 8: 0.350, 9: 0.550, 10: 0.750,
  11: 0.675, 12: 0.800, 13: 1.000, 14: 0.875, 15: 0.850,
};
const POST_CURVE_VOLTE = {
  1: -0.350, 2: -0.350, 3: -0.125, 4: 0.100, 5: 0.150,
  6: -0.075, 7: 0.250, 8: 0.175, 9: 0.475, 10: 0.450,
  11: 0.750, 12: 0.775, 13: 1.000, 14: 0.913, 15: 0.875,
};

const VARIANTS = [
  { mode: 'recent5_fallback', topN: 1 },
  { mode: 'recent5_fallback', topN: 2 },
  { mode: 'recent5_fallback', topN: 3 },
  { mode: 'recent5_fallback', topN: 4 },
  { mode: 'recent5_only', topN: 1 },
  { mode: 'recent5_only', topN: 2 },
  { mode: 'recent5_only', topN: 3 },
  { mode: 'all_before', topN: 1 },
  { mode: 'all_before', topN: 2 },
  { mode: 'all_before', topN: 3 },
  { mode: 'all_before', topN: 4 },
  { mode: 'all_before', topN: 5 },
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJSON(url, retries = 3) {
  let last;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return await res.json();
    } catch (error) {
      last = error;
      await sleep(400 * (i + 1));
    }
  }
  throw last;
}

function loadCache() {
  if (!existsSync(CACHE_FILE)) return { dates: {}, fetchedAt: null };
  return JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
}

function saveCache(cache) {
  mkdirSync(REPORTS, { recursive: true });
  cache.fetchedAt = new Date().toISOString();
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

function extractHorse(start) {
  const h = start.horse ?? {};
  const stats = h.statistics?.life ?? {};
  const driver = start.driver ?? {};
  const dStats = driver.statistics?.years?.['2026'] ?? driver.statistics?.years?.['2025'] ?? {};
  const shoes = h.shoes ?? {};
  const sulkyCode = start.sulky?.type?.code ?? h.sulky?.type?.code ?? start.equipment?.sulky?.type?.code ?? '';
  const starts = stats.starts || 0;
  return {
    startNum: start.number ?? start.postPosition,
    horseId: h.id,
    name: h.name,
    postPosition: start.postPosition,
    distance: start.distance,
    startPoints: stats.startPoints ?? h.statistics?.startPoints ?? 0,
    placePercentage: stats.placePercentage ?? 0,
    winPercentage: stats.winPercentage ?? 0,
    earningsSek: starts > 0 ? (stats.earnings ?? 0) / starts : 0,
    driverWinPct: dStats.winPercentage ?? driver.statistics?.winPercentage ?? 0,
    sulkyType: sulkyCode,
    actualFinishOrder: start.result?.finishOrder ?? 0,
    galloped: start.result?.galloped ?? false,
    disqualified: start.result?.disqualified ?? false,
  };
}

async function fetchDate(date, cache) {
  if (cache.dates[date]) return cache.dates[date];
  console.log(`[${date}] fetching calendar`);
  const calendar = await fetchJSON(`${ATG_BASE}/calendar/day/${date}`);
  const game = calendar.games?.V85?.[0];
  if (!game) {
    cache.dates[date] = { date, gameId: null, races: [] };
    saveCache(cache);
    return cache.dates[date];
  }

  const dateEntry = { date, gameId: game.id, races: [] };
  for (const raceId of game.races ?? []) {
    console.log(`  race ${raceId}`);
    const race = await fetchJSON(`${ATG_BASE}/races/${raceId}`);
    if (!(race.starts ?? []).some(s => (s.result?.finishOrder ?? 0) > 0)) continue;
    const starts = [];
    for (const start of race.starts ?? []) {
      const startNum = start.number ?? start.postPosition;
      let detail = null;
      try {
        detail = await fetchJSON(`${ATG_BASE}/races/${raceId}/start/${startNum}`);
      } catch (error) {
        detail = { error: error.message };
      }
      starts.push({
        horse: extractHorse(start),
        records: detail?.horse?.results?.records ?? [],
        fetchError: detail?.error,
      });
      await sleep(120);
    }
    dateEntry.races.push({
      raceId,
      raceNumber: race.number,
      date: race.date ?? date,
      distance: race.distance ?? 2140,
      startMethod: race.startMethod ?? 'auto',
      starts,
    });
    saveCache({ ...cache, dates: { ...cache.dates, [date]: dateEntry } });
  }
  cache.dates[date] = dateEntry;
  saveCache(cache);
  return dateEntry;
}

function isNumericKmTime(kt) {
  return kt && typeof kt === 'object' && Number.isFinite(kt.minutes) && Number.isFinite(kt.seconds);
}

function kmTimeToSeconds(t) {
  return t.minutes * 60 + t.seconds + (t.tenths ?? 0) / 10;
}

function normalizeKm(kmTime, dist, startMethod) {
  if (!isNumericKmTime(kmTime) || !dist) return null;
  let s = kmTimeToSeconds(kmTime);
  const diff = dist - REFERENCE_DIST;
  if (diff < -DIST_TOLERANCE) s += SHORTER_RATE * (-diff) / 1000;
  else if (diff > DIST_TOLERANCE) s -= LONGER_RATE * diff / 1000;
  if (String(startMethod ?? '').toLowerCase().includes('volt')) s -= VOLTE_ADV_S;
  return Number.isFinite(s) && s > 60 && s < 130 ? s : null;
}

function pickSource(sorted, evalDate, mode) {
  const evalMs = new Date(evalDate).getTime();
  const cutoff = new Date(evalDate);
  cutoff.setMonth(cutoff.getMonth() - 5);
  const before = sorted.filter(r => new Date(r.date).getTime() < evalMs);
  const recent = before.filter(r => new Date(r.date) >= cutoff);
  if (mode === 'recent5_only') return recent;
  if (mode === 'recent5_fallback') return recent.length > 0 ? recent : before;
  if (mode === 'all_before') return before;
  throw new Error(`unknown mode ${mode}`);
}

function processHistory(records, evalDate, variant, horse) {
  const dated = (records ?? [])
    .filter(r => r.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const source = pickSource(dated, evalDate, variant.mode);
  const validKm = source.filter(r =>
    !r.galloped &&
    !r.disqualified &&
    isNumericKmTime(r.kmTime) &&
    (r.start?.distance || r.meta?.distance) &&
    (r.race?.startMethod || r.meta?.startMethod)
  );

  const normalized = validKm
    .map(r => normalizeKm(r.kmTime, r.start?.distance ?? 2140, r.race?.startMethod ?? 'auto'))
    .filter(n => n !== null)
    .sort((a, b) => a - b);

  const n = Math.min(variant.topN, normalized.length);
  const rawKmTime = n > 0 ? normalized.slice(0, n).reduce((s, v) => s + v, 0) / n : null;
  const evalDateObj = new Date(evalDate);
  const lastRaceDate = source[0]?.date ? new Date(source[0].date) : null;
  const layoffDays = lastRaceDate ? Math.round((evalDateObj - lastRaceDate) / 86400000) : null;

  const recentRaces = source
    .filter(r => !r.disqualified)
    .slice(0, FORM_MAX_RACES)
    .map(r => ({
      date: r.date,
      place: r.galloped ? FORM_GALLOP_PL : parseInt(String(r.place ?? ''), 10) || 0,
      postPosition: r.start?.postPosition,
    }))
    .filter(r => r.place > 0);

  const recentStarts = source.filter(r => !r.disqualified).slice(0, 10);
  const gallopRate = recentStarts.length > 0 ? recentStarts.filter(r => r.galloped).length / recentStarts.length : 0;

  const cleanPositions = source
    .filter(r => !r.disqualified && !r.galloped)
    .slice(0, 8)
    .map(r => parseInt(String(r.place ?? ''), 10))
    .filter(p => Number.isFinite(p) && p > 0);
  const consistencyScore = cleanPositions.length >= 3
    ? Math.sqrt(cleanPositions.reduce((s, v) => s + (v - cleanPositions.reduce((a, b) => a + b, 0) / cleanPositions.length) ** 2, 0) / cleanPositions.length)
    : null;

  const odds = dated.filter(r => Number.isFinite(r.odds) && r.odds > 0).map(r => r.odds);
  const averageOdds = odds.length ? odds.reduce((s, v) => s + v, 0) / odds.length : null;
  const distances = validKm.map(r => r.start?.distance).filter(d => Number.isFinite(d) && d > 0).sort((a, b) => a - b);
  const preferredDistance = distances.length ? distances[Math.floor(distances.length / 2)] : null;

  return { rawKmTime, recentRaces, gallopRate, layoffDays, consistencyScore, averageOdds, preferredDistance, coverage: normalized.length, horse };
}

function postAdj(pos, startMethod) {
  const curve = String(startMethod ?? '').toLowerCase().includes('volt') ? POST_CURVE_VOLTE : POST_CURVE_AUTO;
  return curve[pos] ?? 1.0;
}

function driverAdj(wpRaw) {
  let f = wpRaw;
  if (wpRaw > 100) f = wpRaw / 10000;
  else if (wpRaw > 1) f = wpRaw / 100;
  return Math.max(-DRIVER_CAP_S, Math.min(DRIVER_CAP_S, -DRIVER_CAP_S * Math.tanh((f - DRIVER_BASELINE) / DRIVER_SCALE)));
}

function fieldStartPointsAdj(pts, fieldPts) {
  const valid = (fieldPts ?? []).filter(n => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (!Number.isFinite(pts) || valid.length < SP_FIELD_MIN_SIZE) return 0;
  const q = p => {
    const idx = (valid.length - 1) * p;
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return (1 - (idx - lo)) * valid[lo] + (idx - lo) * valid[hi];
  };
  const median = q(0.5);
  const iqr = Math.max(1, q(0.75) - q(0.25));
  return -SP_FIELD_MAX_IMPACT_S * Math.tanh((pts - median) / (iqr * SP_FIELD_BETA));
}

function formAdj(recentRaces, winPctBasisPoints) {
  if (!recentRaces?.length) {
    const pct = winPctBasisPoints > 100 ? winPctBasisPoints / 100 : winPctBasisPoints;
    return Number.isFinite(pct) ? (FORM_FALLBACK_BASELINE_PCT - pct) * FORM_FALLBACK_SCALE_S : 0;
  }
  let score = 0, weight = 0;
  recentRaces.slice(0, FORM_MAX_RACES).forEach((r, i) => {
    const w = Math.pow(2, FORM_MAX_RACES - i - 1);
    const s = r.place === 1 ? -1.0 : r.place <= 3 ? -0.5 : r.place <= 5 ? -0.2 : r.place <= 8 ? 0.3 : 0.6;
    score += s * w;
    weight += w;
  });
  return weight ? (score / weight) * FORM_SCALE_S : 0;
}

function scoreHorse(horse, hist, fieldMedianKm, fieldStartPoints, race) {
  const base = hist.rawKmTime ?? fieldMedianKm ?? 76.5;
  const spWeighted = fieldStartPointsAdj(horse.startPoints, fieldStartPoints) * WEIGHTS.startPoints;
  return base
    + postAdj(horse.postPosition, race.startMethod) * WEIGHTS.postPosition
    + driverAdj(horse.driverWinPct) * WEIGHTS.driverPerformance
    + Math.max(-SP_FINAL_CAP_S, Math.min(SP_FINAL_CAP_S, spWeighted))
    + ((50 - (horse.placePercentage ?? 0) / 100) * 0.001) * WEIGHTS.placePercentage
    + ((15 - (horse.winPercentage ?? 0) / 100) * 0.015) * WEIGHTS.horseWinPercentage
    + Math.max((3000 - (horse.earningsSek ?? 0)) * 0.00001, -0.2) * WEIGHTS.earningsPerStart
    + formAdj(hist.recentRaces, horse.winPercentage) * WEIGHTS.form
    + (hist.gallopRate > 0 ? 0.50 * Math.tanh(hist.gallopRate / 0.15) : 0) * WEIGHTS.gallopRisk
    + (hist.layoffDays > LAYOFF_THRESH ? LAYOFF_MAX_S * Math.tanh((hist.layoffDays - LAYOFF_THRESH) / LAYOFF_SCALE_D) : 0) * WEIGHTS.layoffPenalty
    + (Number.isFinite(hist.consistencyScore) ? CONSISTENCY_MAX * Math.tanh(hist.consistencyScore / CONSISTENCY_SC) : 0) * WEIGHTS.consistencyFactor
    + (hist.averageOdds ? ODDS_MAX_S * Math.tanh((hist.averageOdds - ODDS_NEUTRAL) / ODDS_SCALE) : 0) * WEIGHTS.oddsHistorical
    + (String(race.startMethod).toLowerCase().includes('volt') && hist.preferredDistance > race.distance ? 0.4 : 0) * WEIGHTS.volteStartDistancePenalty;
}

function rankRace(race, variant) {
  const horses = race.starts.map(s => s.horse).filter(h => h.horseId);
  const hists = race.starts.map(s => processHistory(s.records, race.date, variant, s.horse));
  const validKm = hists.map(h => h.rawKmTime).filter(v => v !== null).sort((a, b) => a - b);
  const fieldMedianKm = validKm.length ? validKm[Math.floor(validKm.length / 2)] : 76.5;
  const fieldStartPoints = horses.map(h => h.startPoints);
  return horses
    .map((horse, i) => ({ ...horse, score: scoreHorse(horse, hists[i], fieldMedianKm, fieldStartPoints, race), coverage: hists[i].coverage }))
    .sort((a, b) => a.score - b.score)
    .map((h, i) => ({ ...h, predictedRank: i + 1 }));
}

function metricsForVariant(dates, variant) {
  let races = 0, wins = 0, mrrSum = 0, top3 = 0, top5 = 0, coverageSum = 0, horseCount = 0;
  const rawResults = [];
  for (const dateEntry of dates) {
    for (const race of dateEntry.races) {
      const ranked = rankRace(race, variant);
      const finished = ranked.filter(h => h.actualFinishOrder > 0 && h.actualFinishOrder <= 30 && !h.galloped && !h.disqualified);
      const winner = ranked.find(h => h.actualFinishOrder === 1);
      const topPick = ranked[0];
      if (!winner || !topPick || finished.length < 2) continue;
      races++;
      if (topPick.actualFinishOrder === 1) wins++;
      if (topPick.actualFinishOrder > 0 && topPick.actualFinishOrder <= 3) top3++;
      if (topPick.actualFinishOrder > 0 && topPick.actualFinishOrder <= 5) top5++;
      mrrSum += 1 / winner.predictedRank;
      coverageSum += ranked.filter(h => h.coverage > 0).length;
      horseCount += ranked.length;
      rawResults.push({
        date: dateEntry.date,
        raceId: race.raceId,
        raceNumber: race.raceNumber,
        winner: winner.name,
        winnerRank: winner.predictedRank,
        topPick: topPick.name,
        topPickActual: topPick.actualFinishOrder,
        coverage: ranked.filter(h => h.coverage > 0).length,
        horseCount: ranked.length,
      });
    }
  }
  return {
    name: `${variant.mode}_top${variant.topN}`,
    mode: variant.mode,
    topN: variant.topN,
    races,
    wins,
    winRate: races ? wins / races : 0,
    winnerMRR: races ? mrrSum / races : 0,
    topPickTop3: races ? top3 / races : 0,
    topPickTop5: races ? top5 / races : 0,
    historyCoverage: horseCount ? coverageSum / horseCount : 0,
    rawResults,
  };
}

async function main() {
  const dates = process.argv.slice(2);
  if (!dates.length) {
    console.error('Usage: node scripts/eval-rawtime-variants.mjs YYYY-MM-DD [YYYY-MM-DD ...]');
    process.exit(1);
  }
  mkdirSync(REPORTS, { recursive: true });
  const cache = loadCache();
  const dateEntries = [];
  for (const date of dates) {
    dateEntries.push(await fetchDate(date, cache));
  }
  const results = VARIANTS.map(v => metricsForVariant(dateEntries, v))
    .sort((a, b) => b.winnerMRR - a.winnerMRR || b.winRate - a.winRate);
  const summary = {
    evaluatedAt: new Date().toISOString(),
    dates,
    raceCount: results[0]?.races ?? 0,
    model: 'V37-like scoring from eval-mae, varied only raw history filter/topN',
    cacheFile: CACHE_FILE,
    results: results.map(({ rawResults, ...r }) => ({
      ...r,
      winRate: Number(r.winRate.toFixed(4)),
      winnerMRR: Number(r.winnerMRR.toFixed(4)),
      topPickTop3: Number(r.topPickTop3.toFixed(4)),
      topPickTop5: Number(r.topPickTop5.toFixed(4)),
      historyCoverage: Number(r.historyCoverage.toFixed(4)),
    })),
    rawResultsByVariant: Object.fromEntries(results.map(r => [r.name, r.rawResults])),
  };
  const out = join(REPORTS, `rawtime-variant-eval-${dates[0]}.json`);
  writeFileSync(out, JSON.stringify(summary, null, 2));
  console.log('\nVariant ranking by winner MRR:');
  for (const r of summary.results) {
    console.log(`${r.name.padEnd(24)} MRR=${r.winnerMRR.toFixed(4)} Win=${(r.winRate * 100).toFixed(1)}% Top3=${(r.topPickTop3 * 100).toFixed(1)}% Cov=${(r.historyCoverage * 100).toFixed(1)}%`);
  }
  console.log(`\nSaved ${out}`);
  console.log(`Raw cache ${CACHE_FILE}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
