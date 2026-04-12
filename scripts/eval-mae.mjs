#!/usr/bin/env node
// scripts/eval-mae.mjs
// Full-pipeline autonomous MAE evaluator — V1 vs V2 weights on completed V85 dates.
//
// Usage:
//   node scripts/eval-mae.mjs 2026-04-05
//   node scripts/eval-mae.mjs 2026-04-05 2026-03-29 2026-03-22
//
// NOTE: App uses VITE_GAME_TYPE=V85 — this script evaluates V85 games.
//
// Fetches:
//   1. Calendar (1 call/date)      → game + race IDs
//   2. Race data (8 calls/game)    → horse stats, actual results
//   3. Start history (~10/race)    → historical km times, form, gallop, layoff
//
// Signals included:
//   rawKmTime (normalized to 2140m auto), postPosition, driverPerformance,
//   startPoints, placePercentage, horseWinPercentage, earningsPerStart,
//   form (last 5, exponential), gallopRisk, layoffPenalty, consistencyFactor
//
// Output: reports/mae-auto-{first-date}.json

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ATG_BASE = 'https://www.atg.se/services/racinginfo/v1/api';

// Delays — respectful of ATG rate limits
const RACE_DELAY_MS = 700;
const HISTORY_DELAY_MS = 400;
const DATE_DELAY_MS = 1500;

// ---------------------------------------------------------------------------
// Weight presets
// ---------------------------------------------------------------------------

// V1 — pre-Run46 baseline (browser eval: ~5.289 MAE, ~30.6% win)
const V1 = {
  startPoints: 0.7, placePercentage: 0.6, horseWinPercentage: 0.4,
  earningsPerStart: 0.2, driverPerformance: 1.0, postPosition: 0.9,
  form: 0.5, gallopRisk: 0.5, layoffPenalty: 0.6, consistencyFactor: 0.3,
};

// V2 — Run46 current (goal: lower MAE, higher win%)
const V2 = {
  startPoints: 0.5, placePercentage: 0.6, horseWinPercentage: 0.2,
  earningsPerStart: 0.1, driverPerformance: 1.0, postPosition: 0.9,
  form: 0.8, gallopRisk: 0.5, layoffPenalty: 0.6, consistencyFactor: 0.5,
};

// ---------------------------------------------------------------------------
// Constants (from normalizationConstants.ts)
// ---------------------------------------------------------------------------
const REFERENCE_DIST  = 2140;
const SHORTER_RATE    = 3.2;   // s/km per 1000m shorter
const LONGER_RATE     = 2.0;   // s/km per 1000m longer
const DIST_TOLERANCE  = 10;    // m
const VOLTE_ADV_S     = 1.0;   // subtract for volte historical records

const DRIVER_BASELINE = 0.12;
const DRIVER_SCALE    = 0.10;
const DRIVER_CAP_S    = 0.30;

const SP_BASELINE     = 1200;
const SP_ALPHA        = 0.60;
const SP_MAX_S        = 0.60;
const SP_CAP_S        = 0.30;

const PLACE_BASELINE  = 50;    // percent
const PLACE_SCALE_S   = 0.001;

const WIN_BASELINE    = 15;    // percent
const WIN_SCALE_S     = 0.015;

const EARN_BASELINE   = 3000;  // SEK/start
const EARN_SCALE_S    = 0.00001;

const FORM_WIN        = -1.0;
const FORM_PLACE      = -0.5;
const FORM_GOOD       = -0.2;
const FORM_MID        =  0.3;
const FORM_POOR       =  0.6;
const FORM_SCALE_S    =  0.40;
const FORM_MAX_RACES  =  5;
const FORM_GALLOP_PL  =  15;   // galloped → treated as place 15

const GALLOP_MAX_S    = 0.50;
const GALLOP_SCALE    = 0.15;

const LAYOFF_THRESH   = 14;    // days
const LAYOFF_SCALE_D  = 30;
const LAYOFF_MAX_S    = 0.35;

const CONSISTENCY_MAX = 0.15;
const CONSISTENCY_SC  = 3.0;
const CONSISTENCY_MIN = 3;     // min races for stdDev

// Simplified auto-start post-position curve
const POST_CURVE = {
  1: -0.10, 2: -0.08, 3: -0.04, 4: 0.00, 5: 0.02,
  6:  0.04, 7:  0.06, 8:  0.08, 9: 0.10, 10: 0.12,
};

// ---------------------------------------------------------------------------
// Adjustment calculators
// ---------------------------------------------------------------------------

function postAdj(pos)      { return POST_CURVE[pos] ?? (pos > 10 ? 0.14 : 0.0); }

function driverAdj(wpRaw) {
  const f = wpRaw > 1 ? wpRaw / 100 : wpRaw;
  return Math.max(-DRIVER_CAP_S, Math.min(DRIVER_CAP_S,
    -DRIVER_CAP_S * Math.tanh((f - DRIVER_BASELINE) / DRIVER_SCALE)));
}

function startPointsAdj(pts) {
  if (!Number.isFinite(pts) || pts <= 0) return 0;
  const delta = Math.log1p(pts) - Math.log1p(SP_BASELINE);
  const raw = -SP_MAX_S * Math.tanh(delta / SP_ALPHA);
  return Math.max(-SP_CAP_S, Math.min(SP_CAP_S, Number.isFinite(raw) ? raw : 0));
}

function placeAdj(basisPts) {
  // ATG basis points (e.g. 3478 = 34.78%). Baseline 50%.
  return (PLACE_BASELINE - basisPts / 100) * PLACE_SCALE_S;
}

function winAdj(basisPts) {
  // ATG basis points (e.g. 1500 = 15%). Baseline 15%.
  return (WIN_BASELINE - basisPts / 100) * WIN_SCALE_S;
}

function earningsAdj(earningsSek) {
  // earningsSek = totalEarnings(SEK) / totalStarts. Baseline 3000 SEK/start.
  const adj = (EARN_BASELINE - earningsSek) * EARN_SCALE_S;
  return Math.max(adj, -0.2); // cap bonus
}

function formAdj(recentRaces) {
  // recentRaces: [{place, date}, ...], sorted by date descending (newest first)
  if (!recentRaces || recentRaces.length === 0) return 0;
  const races = recentRaces.slice(0, FORM_MAX_RACES);
  let score = 0, weight = 0;
  races.forEach((r, i) => {
    const w = Math.pow(2, FORM_MAX_RACES - i - 1);
    let s;
    if      (r.place === 1)                        s = FORM_WIN;
    else if (r.place >= 2 && r.place <= 3)         s = FORM_PLACE;
    else if (r.place >= 4 && r.place <= 5)         s = FORM_GOOD;
    else if (r.place >= 6 && r.place <= 8)         s = FORM_MID;   // H3: POOR_THRESHOLD=9
    else                                           s = FORM_POOR;
    score += s * w; weight += w;
  });
  return weight > 0 ? (score / weight) * FORM_SCALE_S : 0;
}

function gallopAdj(gallopRate) {
  if (!gallopRate || gallopRate <= 0) return 0;
  return GALLOP_MAX_S * Math.tanh(gallopRate / GALLOP_SCALE);
}

function layoffAdj(days) {
  if (!Number.isFinite(days) || days <= LAYOFF_THRESH) return 0;
  return LAYOFF_MAX_S * Math.tanh((days - LAYOFF_THRESH) / LAYOFF_SCALE_D);
}

function consistencyAdj(stdDev) {
  if (!Number.isFinite(stdDev) || stdDev <= 0) return 0;
  return CONSISTENCY_MAX * Math.tanh(stdDev / CONSISTENCY_SC);
}

// ---------------------------------------------------------------------------
// km time normalization (normalizeKmTimeForHistory equivalent)
// ---------------------------------------------------------------------------

function kmTimeToSeconds(t) {
  return t.minutes * 60 + t.seconds + (t.tenths ?? 0) / 10;
}

function isNumericKmTime(kt) {
  return kt && typeof kt === 'object' && 'minutes' in kt &&
    Number.isFinite(kt.minutes) && Number.isFinite(kt.seconds);
}

function normalizeHistoricalKmTime(kmTimeObj, dist, startMethod) {
  if (!isNumericKmTime(kmTimeObj) || !dist) return null;
  // ATG kmTime is already in seconds-per-km (e.g. 1:15.5/km = 75.5 s/km).
  // Do NOT divide by distance — just apply a delta correction from REFERENCE_DIST.
  let sPerKm = kmTimeToSeconds(kmTimeObj);

  // Distance correction: piecewise-linear delta (s/km) to normalise to REFERENCE_DIST
  const diff = dist - REFERENCE_DIST;
  if (diff < -DIST_TOLERANCE) {
    sPerKm += SHORTER_RATE * (-diff) / 1000; // shorter race → inflate (slower equivalent)
  } else if (diff > DIST_TOLERANCE) {
    sPerKm -= LONGER_RATE * diff / 1000;     // longer race → deflate (faster equivalent)
  }

  // Volte advantage: subtract to level with auto-start times
  if (startMethod?.toLowerCase().includes('volt')) sPerKm -= VOLTE_ADV_S;

  return Number.isFinite(sPerKm) && sPerKm > 60 && sPerKm < 130 ? sPerKm : null;
}

// ---------------------------------------------------------------------------
// Historical data processing
// ---------------------------------------------------------------------------

function processHistory(records, evalDate) {
  if (!records || records.length === 0) return { rawKmTime: null, recentRaces: [], gallopRate: 0, layoffDays: null, consistencyScore: null };

  const cutoff = new Date(evalDate);
  cutoff.setMonth(cutoff.getMonth() - 5);

  // All records sorted newest-first
  const sorted = [...records]
    .filter(r => r.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  // Layoff: days since any most-recent race
  const lastRaceDate = sorted[0]?.date ? new Date(sorted[0].date) : null;
  const evalDateObj = new Date(evalDate);
  const layoffDays = lastRaceDate
    ? Math.round((evalDateObj - lastRaceDate) / 86400000)
    : null;

  // Filter to recent window for km time and form
  const recentAll = sorted.filter(r => new Date(r.date) >= cutoff);
  const source = recentAll.length > 0 ? recentAll : sorted; // fallback to all-time

  // Valid km-time records (non-gallop, non-DQ, within window)
  const validKm = source.filter(r =>
    !r.galloped && !r.disqualified &&
    isNumericKmTime(r.kmTime) &&
    r.start?.distance && r.race?.startMethod
  );

  // Normalized km times → take best 1 or avg top-2 (H2 fix)
  const normalizedTimes = validKm
    .map(r => normalizeHistoricalKmTime(r.kmTime, r.start.distance, r.race.startMethod))
    .filter(t => t !== null)
    .sort((a, b) => a - b); // ascending: best (fastest) first

  let rawKmTime = null;
  if (normalizedTimes.length === 1) rawKmTime = normalizedTimes[0];
  else if (normalizedTimes.length >= 2) rawKmTime = (normalizedTimes[0] + normalizedTimes[1]) / 2;

  // Recent races for form (last FORM_MAX_RACES from recent window, including gallops)
  const recentRaces = source
    .slice(0, FORM_MAX_RACES * 2)      // scan a bit further
    .filter(r => !r.disqualified)      // exclude DQs (they don't have a place)
    .slice(0, FORM_MAX_RACES)
    .map(r => ({
      date: r.date,
      place: r.galloped ? FORM_GALLOP_PL : parseInt(String(r.place ?? ''), 10) || 0,
    }))
    .filter(r => r.place > 0);

  // Gallop rate (gallops in recent starts, excluding DQs)
  const recentStarts = source.filter(r => !r.disqualified).slice(0, 10);
  const gallopCount = recentStarts.filter(r => r.galloped).length;
  const gallopRate = recentStarts.length > 0 ? gallopCount / recentStarts.length : 0;

  // Consistency: stdDev of recent clean finish positions
  const cleanPositions = recentRaces
    .filter(r => r.place > 0 && r.place !== FORM_GALLOP_PL)
    .map(r => r.place);
  let consistencyScore = null;
  if (cleanPositions.length >= CONSISTENCY_MIN) {
    const mean = cleanPositions.reduce((s, v) => s + v, 0) / cleanPositions.length;
    const variance = cleanPositions.reduce((s, v) => s + (v - mean) ** 2, 0) / cleanPositions.length;
    consistencyScore = Math.sqrt(variance);
  }

  return { rawKmTime, recentRaces, gallopRate, layoffDays, consistencyScore };
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function scoreHorse(horse, hist, fieldMedianKm, weights) {
  const base = hist.rawKmTime ?? fieldMedianKm;

  return base
    + postAdj(horse.postPosition)                          * weights.postPosition
    + driverAdj(horse.driverWinPct)                        * weights.driverPerformance
    + startPointsAdj(horse.startPoints)                    * weights.startPoints
    + placeAdj(horse.placePercentage)                      * weights.placePercentage
    + winAdj(horse.winPercentage)                          * weights.horseWinPercentage
    + earningsAdj(horse.earningsSek)                       * weights.earningsPerStart
    + formAdj(hist.recentRaces)                            * weights.form
    + gallopAdj(hist.gallopRate)                           * weights.gallopRisk
    + layoffAdj(hist.layoffDays)                           * weights.layoffPenalty
    + consistencyAdj(hist.consistencyScore)                * weights.consistencyFactor;
}

function rankHorses(horses, hists, weights) {
  // Compute field median km time for horses without history
  const validKmTimes = hists.map(h => h.rawKmTime).filter(t => t !== null);
  const fieldMedianKm = validKmTimes.length > 0
    ? validKmTimes.sort((a, b) => a - b)[Math.floor(validKmTimes.length / 2)]
    : 76.5; // fallback neutral

  const scored = horses.map((h, i) => ({
    ...h,
    score: scoreHorse(h, hists[i], fieldMedianKm, weights),
  }));
  scored.sort((a, b) => a.score - b.score); // lower = better
  return scored.map((h, i) => ({ ...h, predictedRank: i + 1 }));
}

function computeMAE(ranked) {
  const finished = ranked.filter(h => h.actualFinishOrder > 0 && !h.galloped && !h.disqualified);
  if (finished.length < 2) return null;
  const sum = finished.reduce((s, h) => s + Math.abs(h.predictedRank - h.actualFinishOrder), 0);
  return +(sum / finished.length).toFixed(3);
}

function didWin(ranked) {
  const top = ranked.find(h => h.predictedRank === 1);
  return top ? top.actualFinishOrder === 1 : false;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'race-whisperer-eval/2.0 (autonomous MAE evaluator)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

function extractHorse(start) {
  const life = start.horse?.statistics?.life ?? {};
  const totalEarnings = life.earnings ?? 0;
  const totalStarts   = life.starts ?? 1;
  return {
    horseId:       start.horse?.id,
    name:          start.horse?.name ?? 'Unknown',
    startNum:      start.number ?? start.postPosition ?? 0,
    postPosition:  start.number ?? start.postPosition ?? 0,
    startPoints:   life.startPoints ?? 500,
    placePercentage: life.placePercentage ?? 5000,  // basis points
    winPercentage:   life.winPercentage   ?? 1500,  // basis points
    earningsSek:   totalStarts > 0 ? totalEarnings / totalStarts : 3000,
    driverWinPct:  start.driver?.statistics?.winPercentage ?? 0.12,
    actualFinishOrder: start.result?.finishOrder ?? 0,
    galloped:      start.result?.galloped    ?? false,
    disqualified:  start.result?.disqualified ?? false,
  };
}

// ---------------------------------------------------------------------------
// Per-date evaluation
// ---------------------------------------------------------------------------

async function evalDate(date) {
  console.log(`\n[${date}] Fetching V85 calendar...`);
  let calendar;
  try { calendar = await fetchJSON(`${ATG_BASE}/calendar/day/${date}`); }
  catch (e) { console.error(`  Calendar failed: ${e.message}`); return null; }

  const v85Games = calendar.games?.V85;
  if (!v85Games?.length) { console.log(`  No V85 on this date`); return null; }

  const game = v85Games[0];
  const raceIds = game.races ?? [];
  console.log(`  Game ${game.id} — ${raceIds.length} races`);

  const raceResults = [];

  for (let ri = 0; ri < raceIds.length; ri++) {
    await sleep(RACE_DELAY_MS);
    let race;
    try { race = await fetchJSON(`${ATG_BASE}/races/${raceIds[ri]}`); }
    catch (e) { console.error(`  Race ${raceIds[ri]}: ${e.message}`); continue; }

    const horses = (race.starts ?? []).map(extractHorse).filter(h => h.horseId);
    if (!horses.some(h => h.actualFinishOrder > 0)) {
      console.log(`  Race ${race.number ?? ri+1}: no results yet — skipping`);
      continue;
    }

    // Fetch start history for each horse
    const hists = [];
    for (const horse of horses) {
      await sleep(HISTORY_DELAY_MS);
      let hist = { rawKmTime: null, recentRaces: [], gallopRate: 0, layoffDays: null, consistencyScore: null };
      try {
        const h = await fetchJSON(`${ATG_BASE}/races/${raceIds[ri]}/start/${horse.startNum}`);
        const records = h?.horse?.results?.records ?? [];
        hist = processHistory(records, date);
      } catch (_) { /* no history — use defaults */ }
      hists.push(hist);
    }

    const rankedV1 = rankHorses(horses, hists, V1);
    const rankedV2 = rankHorses(horses, hists, V2);
    const maeV1 = computeMAE(rankedV1);
    const maeV2 = computeMAE(rankedV2);
    const winV1 = didWin(rankedV1);
    const winV2 = didWin(rankedV2);

    const histCoverage = hists.filter(h => h.rawKmTime !== null).length;
    const label = n => n != null ? n.toFixed(2) : 'n/a';
    console.log(
      `  Race ${race.number ?? ri+1}: V1=${label(maeV1)} (${winV1?'W':'-'}) | V2=${label(maeV2)} (${winV2?'W':'-'}) — ${horses.length}h, ${histCoverage}/${horses.length} km-times`
    );

    raceResults.push({ raceId: raceIds[ri], raceNumber: race.number ?? ri+1, horseCount: horses.length, histCoverage, maeV1, maeV2, winV1, winV2 });
  }

  return { date, gameId: game.id, gameType: 'V85', raceResults };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const dates = process.argv.slice(2);
  if (!dates.length) {
    console.error('Usage: node scripts/eval-mae.mjs YYYY-MM-DD [YYYY-MM-DD ...]');
    console.error('Example: node scripts/eval-mae.mjs 2026-04-05 2026-03-29 2026-03-22');
    process.exit(1);
  }

  console.log('=== Race Whisperer — Full-Pipeline Autonomous MAE Evaluator (V85) ===');
  console.log('Signals: rawKmTime + form + gallopRisk + layoff + consistency + career-stats + driver + postPosition');

  const allResults = [];
  for (const date of dates) {
    const r = await evalDate(date);
    if (r) allResults.push(r);
    await sleep(DATE_DELAY_MS);
  }

  const races = allResults.flatMap(d => d.raceResults);
  const n = races.length;
  if (n === 0) { console.log('\nNo completed races found.'); process.exit(0); }

  const sumV1 = races.reduce((s, r) => s + (r.maeV1 ?? 0), 0);
  const sumV2 = races.reduce((s, r) => s + (r.maeV2 ?? 0), 0);
  const winsV1 = races.filter(r => r.winV1).length;
  const winsV2 = races.filter(r => r.winV2).length;
  const meanV1 = +(sumV1 / n).toFixed(3);
  const meanV2 = +(sumV2 / n).toFixed(3);
  const delta  = +((sumV2 - sumV1) / n).toFixed(3);

  const verdict = delta < -0.2 ? 'V2 clearly better'
    : delta < 0 ? 'V2 slightly better'
    : delta === 0 ? 'No difference'
    : delta < 0.2 ? 'V1 slightly better'
    : 'V1 clearly better';

  const summary = {
    evaluatedAt: new Date().toISOString(),
    dates,
    raceCount: n,
    v1: { meanMAE: meanV1, winRate: +(winsV1/n).toFixed(3), wins: winsV1 },
    v2: { meanMAE: meanV2, winRate: +(winsV2/n).toFixed(3), wins: winsV2 },
    delta: { mae: delta, verdict },
    baseline: { source: 'browser full-pipeline, 49 races, 17 dates', meanMAE: 5.289, winRate: 0.306 },
    recommendation: delta <= 0
      ? 'Keep V2 weights. Update status.json accuracy field.'
      : 'Consider reverting to V1. Revert DEFAULT_WEIGHTS in modernKm/types.ts and normalizationConstants.ts.',
    rawResults: allResults,
  };

  console.log('\n=== SUMMARY ===');
  console.log(`Dates:    ${dates.join(', ')}`);
  console.log(`Races:    ${n}`);
  console.log(`V1 MAE:   ${meanV1}   win% ${(winsV1/n*100).toFixed(0)}%`);
  console.log(`V2 MAE:   ${meanV2}   win% ${(winsV2/n*100).toFixed(0)}%`);
  console.log(`Delta:    ${delta >= 0 ? '+' : ''}${delta}  → ${verdict}`);
  console.log(`Action:   ${summary.recommendation}`);

  const outFile = join(ROOT, 'reports', `mae-auto-${dates[0]}.json`);
  mkdirSync(join(ROOT, 'reports'), { recursive: true });
  writeFileSync(outFile, JSON.stringify(summary, null, 2));
  console.log(`\nSaved: ${outFile}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
