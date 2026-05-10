
import { fetchRaceData } from './atgApi';
import { RaceAnalysisCache } from './v75Cache/raceAnalysisCache';
import type { RaceMAEResult, HorseMAEEntry } from './v75Cache/types';
import { log } from '@/lib/logger';
import { makeHorseKey } from './horseIdentity';

/**
 * Fetch actual race results from ATG and compute rank MAE against stored predictions.
 *
 * Returns null when:
 * - No stored prediction exists for this race
 * - The race hasn't finished yet (no finishOrder on any start)
 * - Fewer than 2 horses could be matched
 *
 * Each matched horse contributes |predictedRank − actualFinishOrder| to the mean.
 * Galloped / disqualified horses are excluded (their finishOrder is undefined).
 */
export async function fetchAndComputeMAEForRace(raceId: string): Promise<RaceMAEResult | null> {
  const stored = await RaceAnalysisCache.getRaceAnalysis(raceId);
  if (!stored) {
    log.debug(`MAE: no stored prediction for race ${raceId}`);
    return null;
  }

  const raceData = await fetchRaceData(raceId);
  const starts = raceData.starts ?? [];

  // Build a map: horseKey → actual finish order (skip horses without a clean finish)
  const actualByHorseKey = new Map<string, number>();
  for (const start of starts) {
    const finishOrder = start.result?.finishOrder;
    if (typeof finishOrder === 'number' && finishOrder > 0) {
      const horseKey = start.horseKey ?? makeHorseKey(raceId, start.horse.id, start.postPosition ?? start.number);
      actualByHorseKey.set(horseKey, finishOrder);
    }
  }

  if (actualByHorseKey.size === 0) {
    log.debug(`MAE: race ${raceId} has no finish orders yet`);
    return null;
  }

  const matched: HorseMAEEntry[] = [];
  for (const predicted of stored.horses) {
    const actual = actualByHorseKey.get(predicted.horseKey ?? String(predicted.horseId));
    if (actual === undefined) continue;
    const rankError = Math.abs(predicted.rank - actual);
    matched.push({
      horseKey: predicted.horseKey,
      horseId: predicted.horseId,
      horseName: predicted.horseName,
      predictedRank: predicted.rank,
      actualFinishOrder: actual,
      rankError,
    });
  }

  if (matched.length < 2) {
    log.debug(`MAE: only ${matched.length} matched horse(s) for race ${raceId} — skipping`);
    return null;
  }

  const meanRankError =
    matched.reduce((sum, h) => sum + h.rankError, 0) / matched.length;

  const maeResult: RaceMAEResult = {
    raceId,
    raceNumber: stored.raceNumber,
    analysisDate: stored.analysisDate,
    computedAt: new Date().toISOString(),
    meanRankError,
    horseCount: matched.length,
    horses: matched,
  };

  await RaceAnalysisCache.storeMAEResult(maeResult);
  log.debug(
    `MAE: race ${raceId} — meanRankError=${meanRankError.toFixed(2)} over ${matched.length} horses`,
  );
  return maeResult;
}

export interface AggregateMAEStats {
  /** Mean rank error averaged across all stored MAE results */
  meanRankError: number;
  /** Number of races contributing */
  raceCount: number;
  /** Fraction of races where rank-1 pick actually finished 1st (0–1) */
  winRate: number;
  /** Fraction of races where rank-1 pick finished in top 3 (0–1) */
  top3Rate: number;
  /** Individual results, newest first */
  results: RaceMAEResult[];
}

/** Read all stored MAE results and aggregate them. Returns null if none exist. */
export async function getAggregateMAEStats(): Promise<AggregateMAEStats | null> {
  const results = await RaceAnalysisCache.getAllMAEResults();
  if (results.length === 0) return null;

  const meanRankError =
    results.reduce((sum, r) => sum + r.meanRankError, 0) / results.length;

  let winnerHits = 0;
  let top3Hits = 0;
  for (const r of results) {
    const top1 = r.horses.find(h => h.predictedRank === 1);
    if (top1) {
      if (top1.actualFinishOrder === 1) winnerHits++;
      if (top1.actualFinishOrder <= 3) top3Hits++;
    }
  }
  const winRate = winnerHits / results.length;
  const top3Rate = top3Hits / results.length;

  return { meanRankError, raceCount: results.length, winRate, top3Rate, results };
}
