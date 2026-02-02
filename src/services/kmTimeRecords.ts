/**
 * Km time records: first 200m / last 200m speed from Kmtime folder data.
 * Data is built by scripts/buildKmTimeData.js from Kmtime/* files and served as /kmTimeRecords.json.
 */

/** Slim record: only name + timings we care about (no intervals). */
export interface KmTimeRecordEntry {
  horseName: string;
  date: string;
  first200: string | null;
  last200: string | null;
  best100: string | null;
  best100start: number | null;
  best100stop: number | null;
  actualDistanceRan: number | null;
  actualKMTime: string | null;
  slipstreamDistance: number | null;
  raceName: string | null;
  fileDate?: string;
}

export interface KmTimeRecordsData {
  byHorse: Record<string, KmTimeRecordEntry[]>;
  dates: string[];
}

let cached: KmTimeRecordsData | null = null;

function normalizeHorseName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Load km time records from /kmTimeRecords.json (built from Kmtime/*).
 */
export async function loadKmTimeRecords(): Promise<KmTimeRecordsData> {
  if (cached) return cached;
  try {
    const res = await fetch('/kmTimeRecords.json');
    if (!res.ok) return { byHorse: {}, dates: [] };
    const data = (await res.json()) as KmTimeRecordsData;
    cached = data;
    return data;
  } catch {
    return { byHorse: {}, dates: [] };
  }
}

/**
 * Get km time records for a horse by name (case-insensitive, normalized spaces).
 * Returns newest-first. Only entries with at least first200 or last200 are useful for display.
 */
export function getKmTimeRecordsForHorse(
  data: KmTimeRecordsData,
  horseName: string
): KmTimeRecordEntry[] {
  const key = normalizeHorseName(horseName);
  const list = data.byHorse[key];
  if (!list?.length) return [];
  return list;
}

/**
 * Get the latest record with first200/last200 for display (or null).
 */
export function getLatestKmTimeDisplay(
  records: KmTimeRecordEntry[]
): KmTimeRecordEntry | null {
  const withTimes = records.filter(
    (r) => r.first200 != null || r.last200 != null
  );
  return withTimes.length > 0 ? withTimes[0] : null;
}
