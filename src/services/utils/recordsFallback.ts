export type KmTimeParts = { minutes: number; seconds: number; tenths?: number };
export type StartMethod = "auto" | "volte";
export type Distance = "short" | "medium" | "long";

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
    source: 'statistics' | 'results';
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

    // Skip invalid codes - including qualifiers (gdk) and broken races (br)
    const code = (r.code ?? "").toLowerCase();
    const badCodes = ["0", "it", "dist", "u", "gdk", "br"];
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

/**
 * Check if any records originated from statistics fallback
 */
export function originIncludesStatistics(records: ResultLikeRecord[]): boolean {
  return records.some(r => r.meta?.source === 'statistics');
}

/**
 * Get confidence multiplier based on data source
 * Statistics-only data is less reliable than actual race results
 */
export function getSourceConfidenceMultiplier(records: ResultLikeRecord[]): number {
  const hasStatistics = originIncludesStatistics(records);
  const hasResults = records.some(r => r.meta?.source === 'results');
  
  if (hasResults) return 1.0; // Normal confidence
  if (hasStatistics) return 0.7; // Reduced confidence for statistics-only
  return 1.0; // Default
}
