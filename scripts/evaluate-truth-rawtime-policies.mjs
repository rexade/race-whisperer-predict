#!/usr/bin/env node
import fs from 'fs';
import readline from 'readline';
import { mkdirSync, createReadStream, writeFileSync } from 'fs';
import { basename, join } from 'path';

const DEFAULT_INPUT = 'data/atg-truth-normalized/atg-results-records-2025-11-01_2026-05-11-2026-05-11T17-40-59-997Z.starts.jsonl';
const REPORTS_DIR = 'reports';

const REFERENCE_DIST = 2140;
const SHORTER_RATE = 3.2;
const LONGER_RATE = 2.0;
const DIST_TOLERANCE = 10;
const VOLTE_ADV_S = 1.0;

const SOURCE_ORDER = [
  'detail.horse.results.records',
  'detail.horse.statistics.life.records',
  'detail.horse.statistics.years[*].records',
  'detail.horse.record.time',
  'extended.results.records',
  'extended.statistics.life.records',
  'extended.statistics.years[*].records',
  'extended.record.time',
];

function kmTimeToSeconds(t) {
  return t.minutes * 60 + t.seconds + (t.tenths ?? 0) / 10;
}

function isNumericKmTime(t) {
  return t && typeof t === 'object' && Number.isFinite(t.minutes) && Number.isFinite(t.seconds);
}

function distanceCategoryToMeters(distance) {
  if (distance === 'short') return 1640;
  if (distance === 'medium') return 2140;
  if (distance === 'long') return 2640;
  return undefined;
}

function normalizeKmSeconds(kmTime, distance, startMethod) {
  if (!isNumericKmTime(kmTime)) return null;
  let seconds = kmTimeToSeconds(kmTime);
  const dist = Number.isFinite(distance) ? distance : REFERENCE_DIST;
  const diff = dist - REFERENCE_DIST;
  if (diff < -DIST_TOLERANCE) seconds += SHORTER_RATE * (-diff) / 1000;
  else if (diff > DIST_TOLERANCE) seconds -= LONGER_RATE * diff / 1000;
  if (String(startMethod ?? '').toLowerCase().includes('volt')) seconds -= VOLTE_ADV_S;
  return Number.isFinite(seconds) && seconds > 60 && seconds < 130 ? seconds : null;
}

function statRecordDate(entry) {
  const year = entry.statisticsYear ?? entry.payload?.year;
  if (!year || year === 'life' || year === 'best') return undefined;
  return `${year}-06-30`;
}

function entryToRecord(entry, tier) {
  const payload = entry?.payload ?? {};
  const isStat = tier.includes('statistics') || tier.includes('record.time');
  const kmTime = isStat ? payload.time : payload.kmTime;
  const startMethod = payload.race?.startMethod ?? payload.startMethod;
  const distance = payload.start?.distance ?? distanceCategoryToMeters(payload.distance);
  return {
    tier,
    date: payload.date ?? statRecordDate(entry),
    kmTime,
    place: payload.place,
    galloped: payload.galloped === true,
    disqualified: payload.disqualified === true,
    scratched: payload.scratched === true,
    raceId: payload.race?.id,
    startMethod,
    distance,
  };
}

function hasFinishedPlace(record) {
  const place = Number.parseInt(String(record.place ?? ''), 10);
  return Number.isFinite(place) && place > 0;
}

function hasNumericPlace(record) {
  const place = Number.parseInt(String(record.place ?? ''), 10);
  return Number.isFinite(place) && place >= 0;
}

function usableRecord(record, policy) {
  if (record.scratched || record.galloped || record.disqualified) return false;
  if (!isNumericKmTime(record.kmTime)) return false;
  if (policy.placeMode === 'finished' && !hasFinishedPlace(record)) return false;
  if (policy.placeMode === 'numeric_any' && !hasNumericPlace(record)) return false;
  return normalizeKmSeconds(record.kmTime, record.distance, record.startMethod) !== null;
}

function recordsFromTiers(row, tiers) {
  const out = [];
  for (const tier of tiers) {
    for (const entry of row.sources?.[tier] ?? []) {
      out.push(entryToRecord(entry, tier));
    }
  }
  return out;
}

function sourceRecordsForPolicy(row, policy) {
  const detail = recordsFromTiers(row, ['detail.horse.results.records']);
  if (policy.sourceMode === 'detail') return detail;
  if (policy.sourceMode === 'pooled') return recordsFromTiers(row, SOURCE_ORDER);

  if (detail.some(r => usableRecord(r, policy))) return detail;
  for (const tier of SOURCE_ORDER.slice(1)) {
    const records = recordsFromTiers(row, [tier]);
    if (records.some(r => usableRecord(r, policy))) return records;
  }
  return detail;
}

function windowRecords(records, raceDate, policy) {
  const raceMs = new Date(raceDate).getTime();
  const cutoff = new Date(raceDate);
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffMs = cutoff.getTime();

  const dated = records
    .filter(r => r.date)
    .filter(r => policy.dateMode === 'no_cutoff' || new Date(r.date).getTime() < raceMs);
  const undated = records.filter(r => !r.date);
  const all = [...dated, ...undated];

  if (policy.windowMode === 'all_prior') return all;

  const recent = [
    ...dated.filter(r => new Date(r.date).getTime() >= cutoffMs),
    ...undated,
  ];
  if (policy.windowMode === 'recent90_only') return recent;
  if (policy.windowMode === 'recent90_fill_topN') {
    const recentUsable = recent.filter(r => usableRecord(r, policy));
    if (recentUsable.length >= policy.topN) return recent;
    const recentKeys = new Set(recent.map(r => `${r.tier}|${r.raceId ?? ''}|${r.date ?? ''}|${JSON.stringify(r.kmTime)}`));
    const older = all.filter(r => !recentKeys.has(`${r.tier}|${r.raceId ?? ''}|${r.date ?? ''}|${JSON.stringify(r.kmTime)}`));
    return [...recent, ...older];
  }
  if (recent.some(r => usableRecord(r, policy))) return recent;
  return all;
}

function scoreStart(row, policy) {
  const source = sourceRecordsForPolicy(row, policy);
  const windowed = windowRecords(source, row.queryRace.date, policy);
  const processed = windowed
    .filter(r => usableRecord(r, policy))
    .map(r => ({
      seconds: normalizeKmSeconds(r.kmTime, r.distance, r.startMethod),
      date: r.date,
      tier: r.tier,
    }))
    .filter(r => r.seconds !== null);

  if (!processed.length) return null;

  processed.sort((a, b) => {
    if (policy.pickMode === 'fastest') return a.seconds - b.seconds;
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    if (da !== db) return db - da;
    return a.seconds - b.seconds;
  });

  const n = Math.min(policy.topN, processed.length);
  return {
    seconds: processed.slice(0, n).reduce((sum, r) => sum + r.seconds, 0) / n,
    recordsUsed: n,
    candidates: processed.length,
    firstTier: processed[0]?.tier,
  };
}

function policyName(p) {
  return [
    p.sourceMode,
    p.dateMode,
    p.windowMode,
    p.pickMode,
    p.placeMode,
    `top${p.topN}`,
  ].join('__');
}

function buildPolicies() {
  const policies = [];
  for (const sourceMode of ['detail', 'tiered', 'pooled']) {
    for (const dateMode of ['prior', 'no_cutoff']) {
      for (const windowMode of ['recent90_fallback', 'recent90_fill_topN', 'recent90_only', 'all_prior']) {
        for (const pickMode of ['recent', 'fastest']) {
          for (const placeMode of ['finished', 'numeric_any']) {
            for (const topN of [1, 2, 3]) {
              policies.push({ sourceMode, dateMode, windowMode, pickMode, placeMode, topN });
            }
          }
        }
      }
    }
  }
  return policies;
}

function isFinished(label) {
  return label && label.place > 0 && label.place <= 30 && !label.galloped && !label.disqualified;
}

function addRawObservation(groups, row) {
  const key = `${row.queryRace.id}|${row.queryStart.number ?? row.queryStart.postPosition ?? row.horse?.id ?? row.horse?.name}`;
  if (!groups.has(key)) {
    groups.set(key, {
      key,
      queryRace: row.queryRace,
      queryStart: row.queryStart,
      horse: row.horse,
      sources: {},
      resultLabel: null,
    });
  }

  const grouped = groups.get(key);
  if (!grouped.sources[row.sourceTier]) grouped.sources[row.sourceTier] = [];
  grouped.sources[row.sourceTier].push({
    payload: row.sourcePayload,
    sourceEndpoint: row.sourceEndpoint,
  });

  if (
    row.sourceTier === 'detail.horse.results.records' &&
    row.sourcePayload?.race?.id === row.queryRace.id
  ) {
    grouped.resultLabel = {
      place: Number.parseInt(String(row.sourcePayload.place ?? '0'), 10) || 0,
      kmTime: row.sourcePayload.kmTime,
      disqualified: row.sourcePayload.disqualified === true,
      galloped: row.sourcePayload.galloped === true,
      sourceTier: row.sourceTier,
    };
  }
}

async function loadRaces(inputPath) {
  const races = new Map();
  const rawGroups = new Map();
  let inputShape;
  const rl = readline.createInterface({
    input: createReadStream(inputPath),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line.trim()) continue;
    const row = JSON.parse(line);
    if (!inputShape) inputShape = row.sources ? 'normalized' : row.sourceTier ? 'raw' : 'unknown';

    if (inputShape === 'raw') {
      addRawObservation(rawGroups, row);
      continue;
    }

    const id = row.queryRace.id;
    if (!races.has(id)) {
      races.set(id, {
        race: row.queryRace,
        starts: [],
      });
    }
    races.get(id).starts.push(row);
  }

  if (inputShape === 'raw') {
    for (const row of rawGroups.values()) {
      const id = row.queryRace.id;
      if (!races.has(id)) {
        races.set(id, {
          race: row.queryRace,
          starts: [],
        });
      }
      races.get(id).starts.push(row);
    }
  }

  return [...races.values()];
}

function evaluatePolicy(races, policy) {
  let racesEvaluated = 0;
  let winnerScored = 0;
  let winnerTop1 = 0;
  let winnerTop2 = 0;
  let winnerTop3 = 0;
  let winnerRankSum = 0;
  let winnerMrrSum = 0;
  let topPickWon = 0;
  let topPickTop3 = 0;
  let horseRankAbsError = 0;
  let horseRankCount = 0;
  let scoredStarts = 0;
  let totalStarts = 0;

  for (const race of races) {
    const finished = race.starts.filter(s => isFinished(s.resultLabel));
    const winner = finished.find(s => s.resultLabel.place === 1);
    if (!winner || finished.length < 2) continue;

    const ranked = race.starts
      .map(row => ({ row, raw: scoreStart(row, policy) }))
      .filter(x => x.raw)
      .sort((a, b) => a.raw.seconds - b.raw.seconds)
      .map((x, i) => ({ ...x, predictedRank: i + 1 }));

    if (!ranked.length) continue;

    racesEvaluated++;
    totalStarts += race.starts.length;
    scoredStarts += ranked.length;

    const topPick = ranked[0]?.row;
    if (topPick?.resultLabel?.place === 1) topPickWon++;
    if (topPick?.resultLabel?.place > 0 && topPick.resultLabel.place <= 3) topPickTop3++;

    const rankedByKey = new Map(ranked.map(x => [x.row.key, x]));
    for (const s of finished) {
      const predicted = rankedByKey.get(s.key);
      if (!predicted) continue;
      horseRankAbsError += Math.abs(predicted.predictedRank - s.resultLabel.place);
      horseRankCount++;
    }

    const winnerPredicted = rankedByKey.get(winner.key);
    if (winnerPredicted) {
      const rank = winnerPredicted.predictedRank;
      winnerScored++;
      winnerRankSum += rank;
      winnerMrrSum += 1 / rank;
      if (rank <= 1) winnerTop1++;
      if (rank <= 2) winnerTop2++;
      if (rank <= 3) winnerTop3++;
    }
  }

  return {
    name: policyName(policy),
    ...policy,
    racesEvaluated,
    winnerScored,
    top1: winnerScored ? winnerTop1 / winnerScored : 0,
    top2: winnerScored ? winnerTop2 / winnerScored : 0,
    top3: winnerScored ? winnerTop3 / winnerScored : 0,
    avgWinnerRank: winnerScored ? winnerRankSum / winnerScored : null,
    winnerMRR: winnerScored ? winnerMrrSum / winnerScored : 0,
    topPickWin: racesEvaluated ? topPickWon / racesEvaluated : 0,
    topPickTop3: racesEvaluated ? topPickTop3 / racesEvaluated : 0,
    rankMAE: horseRankCount ? horseRankAbsError / horseRankCount : null,
    scoredCoverage: totalStarts ? scoredStarts / totalStarts : 0,
  };
}

function pct(v) {
  return `${(v * 100).toFixed(2)}%`;
}

async function main() {
  const inputPath = process.argv[2] ?? DEFAULT_INPUT;
  const races = await loadRaces(inputPath);
  const policies = buildPolicies();
  const results = policies
    .map(policy => evaluatePolicy(races, policy))
    .sort((a, b) =>
      b.top1 - a.top1 ||
      b.top2 - a.top2 ||
      b.top3 - a.top3 ||
      a.avgWinnerRank - b.avgWinnerRank ||
      b.scoredCoverage - a.scoredCoverage
    );

  mkdirSync(REPORTS_DIR, { recursive: true });
  const outPath = join(REPORTS_DIR, `truth-rawtime-policies-${basename(inputPath).replace(/\.jsonl$/i, '')}.json`);
  writeFileSync(outPath, JSON.stringify({
    evaluatedAt: new Date().toISOString(),
    inputPath,
    raceCount: races.length,
    policyCount: policies.length,
    results,
  }, null, 2));

  console.log(`Loaded ${races.length} races from ${inputPath}`);
  console.log(`Evaluated ${policies.length} policies`);
  console.log('\nTop policies by winner Top1, then Top2/Top3:');
  console.log('| Policy | Races | Winner Scored | Top1 | Top2 | Top3 | Avg Winner Rank | Rank MAE | Coverage |');
  console.log('|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const r of results.slice(0, 30)) {
    console.log(`| ${r.name} | ${r.racesEvaluated} | ${r.winnerScored} | ${pct(r.top1)} | ${pct(r.top2)} | ${pct(r.top3)} | ${r.avgWinnerRank?.toFixed(2) ?? 'n/a'} | ${r.rankMAE?.toFixed(2) ?? 'n/a'} | ${pct(r.scoredCoverage)} |`);
  }
  console.log(`\nSaved ${outPath}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
