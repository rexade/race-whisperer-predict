export type KmTimeParts = { minutes: number; seconds: number; tenths?: number };
export type StartMethod = "auto" | "volte";
export type Distance = "short" | "medium" | "long";
export type RecordSource =
  | 'statistics'
  | 'results'
  | 'record-best'
  | 'extended-results'
  | 'extended-statistics-life'
  | 'extended-statistics-years'
  | 'extended-fallback-record';

export interface ResultLikeRecord {
  date?: string;
  kmTime: { minutes?: number; seconds?: number; tenths?: number; code?: string };
  place?: string | number;
  race?: { id?: string; startMethod?: StartMethod };
  track?: { name?: string };
  start?: { distance?: number; postPosition?: number };
  galloped?: boolean;
  disqualified?: boolean;
  meta?: { 
    code?: string; 
    distance?: Distance; 
    startMethod?: StartMethod; 
    year?: string;
    source: RecordSource;
    isLastResort?: boolean;
    extended?: boolean; // Provenance flag: came from extended endpoint
  };
}

type StatRecord = {
  code?: string;
  startMethod?: StartMethod;
  distance?: Distance;
  time?: KmTimeParts;
  place?: number;
  year?: string;
};

export function distanceCategoryToMeters(distance?: Distance): number | undefined {
  if (distance === 'short') return 1640;
  if (distance === 'medium') return 2140;
  if (distance === 'long') return 2640;
  return undefined;
}

export function isAggregateRecordSource(source?: string): boolean {
  return source === 'statistics' ||
    source === 'record-best' ||
    source === 'extended-fallback-record' ||
    source?.startsWith('extended-statistics') === true;
}

/**
 * Extract records from statistics when results.records is missing
 * This handles foreign horses and horses with limited ATG data
 */
export function extractRecordsFromStatistics(horse: any): ResultLikeRecord[] {
  const out: ResultLikeRecord[] = [];
  const years = horse?.statistics?.years ?? {};
  const life = horse?.statistics?.life ?? {};

  const push = (r: StatRecord, year?: string) => {
    // Skip non-times like "0", "it", "dist", "u", etc
    if (!r?.time || typeof r.time.minutes !== "number" || typeof r.time.seconds !== "number") return;

    // Skip invalid codes - including qualifiers (gdk), broken races (br), placed without time (p), and disqualified (dq)
    const code = (r.code ?? "").toLowerCase();
    const badCodes = ["0", "it", "dist", "u", "gdk", "br", "p", "dq"];
    if (badCodes.includes(code)) return;

    // Map code -> startMethod/distance if missing
    // aK/aM/aL => auto + short/medium/long; K/M/L => volte + short/medium/long
    // Handle case-insensitive matching
    const isAuto = /^a/i.test(code);
    const rawLetter = code.replace(/^a/i, ""); // drop leading a/A
    const letter = rawLetter.toUpperCase(); // K/M/L
    
    const distance: Distance | undefined =
      r.distance ||
      (letter === "K" ? "short" : letter === "M" ? "medium" : letter === "L" ? "long" : undefined);

    const startMethod: StartMethod | undefined = r.startMethod || (isAuto ? "auto" : letter ? "volte" : undefined);

    // Do NOT estimate distance in meters for statistics records
    // This avoids skewing speed normalization or lane bias calculations
    // Rely on meta.distance (category) instead

    // Handle date: for current year, use end of year to avoid time window exclusions
    // For 'life' records, leave undefined so time window checks can be skipped
    const currentYear = new Date().getFullYear();
    const recordDate = year && year !== 'life' 
      ? (parseInt(year) === currentYear ? `${year}-12-31` : `${year}-06-30`)
      : undefined;

    out.push({
      date: recordDate,
      kmTime: { 
        minutes: r.time.minutes,
        seconds: r.time.seconds,
        tenths: r.time.tenths ?? 0 // Guard for missing tenths
      },
      place: typeof r.place === "number" ? String(r.place) : "0", // Keep numeric-like for filters
      race: { 
        id: `stat_${code}_${year ?? 'life'}`,
        startMethod 
      },
      track: { name: "Unknown" },
      start: { 
        // Leave distance undefined - use meta.distance instead
        // This prevents fake meter values from skewing normalization
        postPosition: 1 // Unknown, use neutral position
      },
      galloped: false,
      disqualified: false,
      meta: { 
        code, 
        distance, 
        startMethod, 
        year: year ?? 'life',
        source: 'statistics' as const
      },
    });
  };

  // years[*].records
  for (const yr of Object.keys(years)) {
    const recs: StatRecord[] = years[yr]?.records ?? [];
    recs.forEach(r => push(r, yr));
  }

  // life.records
  const lifeRecs: StatRecord[] = life?.records ?? [];
  lifeRecs.forEach(r => push(r));

  return out;
}

function extractBestRecordTime(horse: any): ResultLikeRecord[] {
  const record = horse?.record;
  if (!record?.time || typeof record.time.minutes !== 'number' || typeof record.time.seconds !== 'number') {
    return [];
  }

  const code = String(record.code ?? '').toLowerCase();
  const badCodes = ['0', 'it', 'dist', 'u', 'gdk', 'br', 'p', 'dq'];
  if (badCodes.includes(code)) return [];

  const isAuto = /^a/i.test(code);
  const rawLetter = code.replace(/^a/i, '').toUpperCase();
  const distance: Distance | undefined =
    record.distance ||
    (rawLetter === 'K' ? 'short' : rawLetter === 'M' ? 'medium' : rawLetter === 'L' ? 'long' : undefined);
  const startMethod: StartMethod | undefined =
    record.startMethod || (isAuto ? 'auto' : rawLetter ? 'volte' : undefined);

  return [{
    date: undefined,
    kmTime: {
      minutes: record.time.minutes,
      seconds: record.time.seconds,
      tenths: record.time.tenths ?? 0,
      code,
    },
    place: '0',
    race: {
      id: `record_best_${code || 'unknown'}`,
      startMethod,
    },
    track: { name: 'Unknown' },
    start: {
      distance: distanceCategoryToMeters(distance),
      postPosition: 1,
    },
    galloped: false,
    disqualified: false,
    meta: {
      code,
      distance,
      startMethod,
      year: 'best',
      source: 'record-best',
      isLastResort: true,
    },
  }];
}

export function collectHorseRecordCandidates(horse: any): {
  records: ResultLikeRecord[];
  counts: { results: number; statistics: number; bestRecord: number; total: number };
} {
  const resultRecords = (horse?.results?.records ?? []).map((record: any) => ({
    ...record,
    meta: { ...(record.meta ?? {}), source: 'results' as const },
  }));
  const statisticsRecords = extractRecordsFromStatistics(horse);

  // horse.record.time is a personal-best style value, not a normal historical
  // start. Use it only when there are no normal or aggregate candidates.
  const bestRecord = resultRecords.length === 0 && statisticsRecords.length === 0
    ? extractBestRecordTime(horse)
    : [];

  const records = [...resultRecords, ...statisticsRecords, ...bestRecord];
  return {
    records,
    counts: {
      results: resultRecords.length,
      statistics: statisticsRecords.length,
      bestRecord: bestRecord.length,
      total: records.length,
    },
  };
}

/**
 * Check if any records originated from statistics fallback
 */
export function originIncludesStatistics(records: ResultLikeRecord[]): boolean {
  return records.some(r => isAggregateRecordSource(r.meta?.source));
}

/**
 * Get confidence multiplier based on data source
 * Statistics-only data is less reliable than actual race results
 */
export function getSourceConfidenceMultiplier(records: ResultLikeRecord[]): number {
  const hasStatistics = originIncludesStatistics(records);
  const hasResults = records.some(r => r.meta?.source === 'results');
  const hasLastResort = records.some(r => r.meta?.isLastResort === true);
  
  if (hasResults) return 1.0; // Normal confidence - real race results present
  if (hasLastResort) return 0.5; // Single best record only
  if (hasStatistics) return 0.7; // Reduced confidence for statistics-only
  return 1.0; // Default
}

/**
 * Get statistics breakdown for telemetry
 */
export function getStatisticsBreakdown(records: ResultLikeRecord[]): {
  totalRecords: number;
  statisticsRecords: number;
  resultsRecords: number;
  distanceBreakdown: { short: number; medium: number; long: number; unknown: number };
} {
  const statisticsRecords = records.filter(r => isAggregateRecordSource(r.meta?.source));
  const resultsRecords = records.filter(r => r.meta?.source === 'results' || !r.meta?.source);
  
  const distanceBreakdown = {
    short: 0,
    medium: 0,
    long: 0,
    unknown: 0
  };
  
  statisticsRecords.forEach(r => {
    const dist = r.meta?.distance;
    if (dist === 'short') distanceBreakdown.short++;
    else if (dist === 'medium') distanceBreakdown.medium++;
    else if (dist === 'long') distanceBreakdown.long++;
    else distanceBreakdown.unknown++;
  });
  
  return {
    totalRecords: records.length,
    statisticsRecords: statisticsRecords.length,
    resultsRecords: resultsRecords.length,
    distanceBreakdown
  };
}
