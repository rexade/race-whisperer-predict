/**
 * Parse kmtid.atgx.se payload (e.g. from races.js).
 * Tries: (1) direct JSON, (2) global var assignment, (3) JSON substring.
 * Update extraction paths when real structure is known (see docs/KMTID_INVESTIGATION.md).
 */

import type { KmtidPayload, KmtidStart } from './types';
import type { KmtidPerStartAnalytics } from '@/components/v75/types/postRaceAnalysisTypes';

/**
 * Try to parse raw text as JSON or extract JSON from JS (e.g. var x = {...};).
 */
export function parseKmtidRawText(text: string): KmtidPayload | null {
  const trimmed = text.trim();

  // 1) Direct JSON
  if (trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed) as KmtidPayload;
    } catch {
      // fall through
    }
  }

  // 2) Global assignment: __RACES__ = {...} or races = {...} or similar
  const assignmentMatch = trimmed.match(
    /(?:var|let|const|window\.\w+)\s*=\s*(\{[\s\S]*\})\s*;?\s*(?:\n|$)/m
  );
  if (assignmentMatch) {
    try {
      return JSON.parse(assignmentMatch[1]) as KmtidPayload;
    } catch {
      // fall through
    }
  }

  // 3) First top-level object (brace count)
  const firstBrace = trimmed.indexOf('{');
  if (firstBrace === -1) return null;
  let depth = 0;
  let end = -1;
  for (let i = firstBrace; i < trimmed.length; i++) {
    const c = trimmed[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end !== -1) {
    try {
      return JSON.parse(trimmed.slice(firstBrace, end + 1)) as KmtidPayload;
    } catch {
      // fall through
    }
  }

  return null;
}

/**
 * Extract analytics from a kmtid start object (paths TBD after real payload inspection).
 */
function extractStartAnalytics(start: KmtidStart): KmtidPerStartAnalytics | undefined {
  // Support multiple possible key names from real payload
  const raw = start as unknown as Record<string, unknown>;
  const first200m = raw.first200mPace ?? raw.first200m ?? raw.first_200m;
  const last200m = raw.last200mPace ?? raw.last200m ?? raw.last_200m;
  const metersRun = raw.metersRun ?? raw.sprungnaMeter;
  const calculatedKmTime = raw.calculatedKmTime ?? raw.omraknadKmTid;
  const slipstream = raw.slipstreamMeters ?? raw.slipstream;
  const graph = raw.performanceGraphData ?? raw.graphData ?? raw.graph;

  const hasAny =
    first200m != null ||
    last200m != null ||
    (typeof metersRun === 'number' && metersRun > 0) ||
    calculatedKmTime != null ||
    (typeof slipstream === 'number') ||
    (Array.isArray(graph) && graph.length > 0);

  if (!hasAny) return undefined;

  const formatPace = (v: unknown): string | undefined => {
    if (v == null) return undefined;
    if (typeof v === 'string') return v;
    if (typeof v === 'number') return String(v);
    return undefined;
  };

  const formatGraph = (
    arr: unknown
  ): Array<{ x: number; y: number } | { distance: number; value: number }> | undefined => {
    if (!Array.isArray(arr) || arr.length === 0) return undefined;
    return arr.map((point) => {
      const p = point as Record<string, number>;
      if (p.x != null && p.y != null) return { x: p.x, y: p.y };
      if (p.distance != null && p.value != null) return { distance: p.distance, value: p.value };
      return { x: 0, y: 0 };
    });
  };

  return {
    first200mPace: formatPace(first200m),
    last200mPace: formatPace(last200m),
    metersRun: typeof metersRun === 'number' ? metersRun : undefined,
    calculatedKmTime: formatPace(calculatedKmTime),
    slipstreamMeters: typeof slipstream === 'number' ? slipstream : undefined,
    performanceGraphData: formatGraph(graph),
  };
}

/**
 * Map parsed kmtid payload to per-(raceId, startNumber) analytics.
 */
export function mapKmtidPayloadToAnalytics(payload: KmtidPayload): Map<string, KmtidPerStartAnalytics> {
  const map = new Map<string, KmtidPerStartAnalytics>();
  const races = payload.races ?? (Array.isArray(payload) ? payload : []);

  for (const race of races as { id?: string; raceId?: string; starts?: KmtidStart[] }[]) {
    const raceId = race.id ?? race.raceId ?? '';
    const starts = race.starts ?? [];
    for (const start of starts) {
      const startNumber = start.number ?? start.postPosition ?? 0;
      const key = `${raceId}:${startNumber}`;
      const analytics = extractStartAnalytics(start);
      if (analytics) map.set(key, analytics);
    }
  }
  return map;
}

/**
 * Normalize horse name for matching (kmtid may not expose stable horseId; match by name).
 * Trim, lowercase, collapse multiple spaces; handle object with .name.
 */
export function normalizeHorseName(name: unknown): string {
  if (name == null) return '';
  const s = typeof name === 'string' ? name : (typeof (name as { name?: string }).name === 'string' ? (name as { name: string }).name : String(name));
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Map parsed kmtid payload to per-horseId analytics (for matching upcoming-race horses to historical data).
 * kmtid data is ~2 weeks old; key by horseId when present (may be missing or unreliable in n+1 race structure).
 */
export function mapKmtidPayloadToAnalyticsByHorseId(payload: KmtidPayload): Map<number, KmtidPerStartAnalytics> {
  const map = new Map<number, KmtidPerStartAnalytics>();
  const races = payload.races ?? (Array.isArray(payload) ? payload : []);

  for (const race of races as { id?: string; raceId?: string; starts?: KmtidStart[] }[]) {
    const starts = race.starts ?? [];
    for (const start of starts) {
      const horseId = start.horse?.id ?? (start as unknown as Record<string, number>).horseId;
      if (horseId == null) continue;
      const analytics = extractStartAnalytics(start);
      if (analytics) map.set(Number(horseId), analytics);
    }
  }
  return map;
}

/**
 * Map parsed kmtid payload to per-horse-name analytics (fallback when horseId is missing or doesn't match).
 * kmtid data is often n+1 per race without a proper horse ID; key by normalized horse name.
 */
export function mapKmtidPayloadToAnalyticsByHorseName(payload: KmtidPayload): Map<string, KmtidPerStartAnalytics> {
  const map = new Map<string, KmtidPerStartAnalytics>();
  const races = payload.races ?? (Array.isArray(payload) ? payload : []);

  for (const race of races as { id?: string; raceId?: string; starts?: KmtidStart[] }[]) {
    const starts = race.starts ?? [];
    for (const start of starts) {
      const rawName = start.horse?.name ?? (start as unknown as Record<string, unknown>).horseName;
      const key = normalizeHorseName(rawName);
      if (!key) continue;
      const analytics = extractStartAnalytics(start);
      if (analytics) map.set(key, analytics);
    }
  }
  return map;
}
