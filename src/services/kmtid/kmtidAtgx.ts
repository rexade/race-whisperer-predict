/**
 * Fetch and parse kmtid.atgx.se data (e.g. races.js) for post-race analytics.
 * Used when viewing post-race analysis to show first/last 200m, meters run, slipstream, graph.
 * Fetched client-side; may fail due to CORS or if kmtid URL/structure changes.
 */

import { parseKmtidRawText, mapKmtidPayloadToAnalytics, mapKmtidPayloadToAnalyticsByHorseId, mapKmtidPayloadToAnalyticsByHorseName } from './parseKmtidPayload';
import type { KmtidPayload } from './types';
import type { V75ActualResult } from '@/components/v75/types/postRaceAnalysisTypes';
import type { KmtidPerStartAnalytics } from '@/components/v75/types/postRaceAnalysisTypes';

/** kmtid.atgx.se data is always ~2 weeks old; we use it as historical reference for matching horses. */
const KMTID_HISTORICAL_DAYS_AGO = 14;

const KMTID_BASE = 'https://kmtid.atgx.se';

/**
 * Resolve kmtid game id from date (YYYY-MM-DD).
 * Example: 2026-01-03 -> 260103 (YYMMDD).
 */
export function dateToKmtidGameId(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const yy = y % 100;
  return `${yy}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`;
}

/**
 * Build URL for kmtid races.js for a given game id (e.g. 260103).
 */
export function getKmtidRacesJsUrl(gameId: string): string {
  return `${KMTID_BASE}/${gameId}/js/races.js`;
}

/**
 * Fetch kmtid data for a date. Uses gameId from date (YYMMDD) by default.
 * Returns null on fetch/parse failure (kmtid optional).
 */
export async function fetchKmtidDataForDate(
  date: string,
  gameIdOverride?: string
): Promise<Map<string, KmtidPerStartAnalytics> | null> {
  const gameId = gameIdOverride ?? dateToKmtidGameId(date);
  const url = getKmtidRacesJsUrl(gameId);

  try {
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
    });
    if (!response.ok) return null;
    const text = await response.text();
    const payload = parseKmtidRawText(text) as KmtidPayload | null;
    if (!payload) return null;
    return mapKmtidPayloadToAnalytics(payload);
  } catch {
    return null;
  }
}

/**
 * Merge kmtid analytics into actual results by raceId and postPosition.
 */
export function mergeKmtidIntoResults(
  results: V75ActualResult[],
  kmtidMap: Map<string, KmtidPerStartAnalytics> | null
): V75ActualResult[] {
  if (!kmtidMap || kmtidMap.size === 0) return results;

  return results.map((race) => {
    const finishOrder = race.finishOrder.map((entry) => {
      const key = `${race.raceId}:${entry.postPosition}`;
      const analytics = kmtidMap.get(key);
      if (!analytics) return entry;
      return { ...entry, kmtidAnalytics: analytics };
    });
    return { ...race, finishOrder };
  });
}

/**
 * Get date N days before a given YYYY-MM-DD date.
 */
function dateMinusDays(date: string, days: number): string {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Result of fetchKmtidDataByHorseIdForDate: match by horseId first, then by normalized horse name. */
export interface KmtidByHorseLookup {
  byHorseId: Map<number, KmtidPerStartAnalytics>;
  byHorseName: Map<string, KmtidPerStartAnalytics>;
}

/**
 * Fetch kmtid historical data for matching horses in upcoming races.
 * kmtid data is always ~2 weeks old; we fetch for (analysisDate - 14 days).
 * Returns two maps: by horseId (when kmtid exposes it) and by normalized horse name (fallback for n+1 / no-ID data).
 * Use: lookup by horseId first; if no match, lookup by normalizeHorseName(horseName).
 */
export async function fetchKmtidDataByHorseIdForDate(
  analysisDate: string,
  gameIdOverride?: string
): Promise<KmtidByHorseLookup | null> {
  const historicalDate = dateMinusDays(analysisDate, KMTID_HISTORICAL_DAYS_AGO);
  const gameId = gameIdOverride ?? dateToKmtidGameId(historicalDate);
  const url = getKmtidRacesJsUrl(gameId);

  try {
    const response = await fetch(url, { method: 'GET', mode: 'cors', credentials: 'omit' });
    if (!response.ok) return null;
    const text = await response.text();
    const payload = parseKmtidRawText(text) as KmtidPayload | null;
    if (!payload) return null;
    return {
      byHorseId: mapKmtidPayloadToAnalyticsByHorseId(payload),
      byHorseName: mapKmtidPayloadToAnalyticsByHorseName(payload),
    };
  } catch {
    return null;
  }
}
