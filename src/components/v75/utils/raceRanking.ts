/**
 * Shared ranking helpers for the results views (race table, kupong, race strip).
 *
 * All views rank horses the same way — by predicted normalized km-time — and
 * derive betting guidance from the time margins between ranks:
 *   margin ≥ 0.8 s  → spik candidate (single)
 *   margin ≥ 0.3 s  → clear favorite
 *   otherwise       → open leg, spread
 */

import { V75HorseResult } from '../types/raceResultTypes';

export const predictedSeconds = (h: V75HorseResult): number => {
  const t = h.modernNormalizedResult!.modernNormalizedTime;
  return t.minutes * 60 + t.seconds + t.tenths / 10;
};

/** Horses with a prediction, fastest first — the canonical display order. */
export function sortByPrediction(horses: V75HorseResult[]): V75HorseResult[] {
  return horses
    .filter(h => h.modernNormalizedResult)
    .sort((a, b) => predictedSeconds(a) - predictedSeconds(b));
}

/** Predicted-time gap from rank 1 to rank 2 (seconds); undefined for <2 horses. */
export function winnerMargin(sorted: V75HorseResult[]): number | undefined {
  return sorted.length >= 2 ? predictedSeconds(sorted[1]) - predictedSeconds(sorted[0]) : undefined;
}

export type LegConfidence = 'spik' | 'favorit' | 'oppet';

export function legConfidence(margin: number | undefined): LegConfidence {
  if (margin === undefined) return 'oppet';
  if (margin >= 0.8) return 'spik';
  if (margin >= 0.3) return 'favorit';
  return 'oppet';
}

export interface SpreadSuggestion {
  type: LegConfidence;
  /** Horses to cover, in rank order (1 for spik). */
  horses: V75HorseResult[];
}

/**
 * Suggested ticket coverage for a leg: the leader plus every horse within
 * COVER_WINDOW_S of the leader's predicted time, capped at MAX_COVER.
 */
const COVER_WINDOW_S = 0.6;
const MAX_COVER = 5;

export function spreadSuggestion(sorted: V75HorseResult[]): SpreadSuggestion {
  const margin = winnerMargin(sorted);
  const type = legConfidence(margin);
  if (sorted.length === 0) return { type: 'oppet', horses: [] };
  if (type === 'spik') return { type, horses: [sorted[0]] };

  const leader = predictedSeconds(sorted[0]);
  const covered = sorted.filter(h => predictedSeconds(h) - leader <= COVER_WINDOW_S).slice(0, MAX_COVER);
  // An open leg always deserves at least a 3-horse spread when the field allows
  const minCover = type === 'oppet' ? 3 : 2;
  const horses = covered.length >= minCover ? covered : sorted.slice(0, Math.min(minCover, sorted.length));
  return { type, horses };
}

/**
 * Value picks: horses the model ranks markedly higher than the betting market.
 * Market rank comes from betDistribution (spelprocent, descending). A horse is
 * a value pick when the model has it top-4 and at least 3 ranks above market.
 */
export function valuePickIds(sorted: V75HorseResult[]): Set<number> {
  const withMarket = sorted.filter(h => h.betDistribution !== undefined && h.betDistribution > 0);
  if (withMarket.length < 4) return new Set();

  const marketOrder = [...withMarket].sort((a, b) => (b.betDistribution ?? 0) - (a.betDistribution ?? 0));
  const marketRank = new Map<number, number>();
  marketOrder.forEach((h, i) => marketRank.set(h.horseId, i + 1));

  const value = new Set<number>();
  sorted.forEach((h, i) => {
    const modelRank = i + 1;
    const mkt = marketRank.get(h.horseId);
    if (mkt !== undefined && modelRank <= 4 && mkt - modelRank >= 3) value.add(h.horseId);
  });
  return value;
}
