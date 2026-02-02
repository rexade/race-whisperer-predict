/**
 * Centralized race fetch with in-memory cache.
 * Fetches races/{raceId} once per raceId to avoid duplicate requests across v75ResultsFetcher,
 * v75CalendarApi, and other consumers.
 */

const RACE_CACHE = new Map<string, { data: unknown; fetchedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function isExpired(entry: { fetchedAt: number }): boolean {
  return Date.now() - entry.fetchedAt > CACHE_TTL_MS;
}

export async function fetchRaceById(raceId: string): Promise<unknown> {
  const cached = RACE_CACHE.get(raceId);
  if (cached && !isExpired(cached)) {
    return cached.data;
  }

  const response = await fetch(
    `https://www.atg.se/services/racinginfo/v1/api/races/${raceId}`
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch race data: ${response.statusText}`);
  }
  const data = await response.json();
  RACE_CACHE.set(raceId, { data, fetchedAt: Date.now() });
  return data;
}

export function clearRaceCache(): void {
  RACE_CACHE.clear();
}

export function getRaceCacheSize(): number {
  return RACE_CACHE.size;
}
