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

    // Skip invalid codes
    const code = r.code ?? "";
    if (["0", "it", "dist", "u"].includes(code.toLowerCase())) return;

    // Map code -> startMethod/distance if missing
    // aK/aM/aL => auto + short/medium/long; K/M/L => volte + short/medium/long
    const isAuto = code.startsWith("a");
    const letter = code.replace(/^a/, ""); // K/M/L
    const distance: Distance | undefined =
      r.distance ||
      (letter === "K" ? "short" : letter === "M" ? "medium" : letter === "L" ? "long" : undefined);

    const startMethod: StartMethod | undefined = r.startMethod || (isAuto ? "auto" : letter ? "volte" : undefined);

    // Estimate distance in meters from distance category
    const distanceMeters = distance === "short" ? 1640 : distance === "medium" ? 2140 : distance === "long" ? 2640 : undefined;

    out.push({
      date: year ? `${year}-01-01` : undefined, // Approximate date for sorting
      kmTime: { ...r.time },
      place: String(r.place ?? "0"),
      race: { 
        id: `stat_${code}_${year ?? 'life'}`,
        startMethod 
      },
      track: { name: "Unknown" },
      start: { 
        distance: distanceMeters,
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
