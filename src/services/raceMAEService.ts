
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
 * - The race hasn't finished yet (no result position on any start)
 * - Fewer than 2 horses could be matched
 *
 * Each matched horse contributes the error between its compressed predicted and
 * actual ranks in the eligible cohort. Its literal finish position is retained
 * separately for win/top-3 reporting.
 * Galloped / disqualified horses are excluded (their result position is undefined).
 */
export async function fetchAndComputeMAEForRace(raceId: string): Promise<RaceMAEResult | null> {
  const stored = await RaceAnalysisCache.getRaceAnalysis(raceId);
  if (!stored) {
    log.debug(`MAE: no stored prediction for race ${raceId}`);
    return null;
  }

  const raceData = await fetchRaceData(raceId);
  const starts = raceData.starts ?? [];

  // Build a map: horseKey → literal finish position (skip horses without a clean finish)
  const actualByHorseKey = new Map<string, number>();
  for (const start of starts) {
    const finishOrder = start.result?.finalPosition ?? start.result?.finishOrder;
    if (typeof finishOrder === 'number' && finishOrder > 0) {
      const horseKey = start.horseKey ?? makeHorseKey(raceId, start.horse.id, start.number ?? start.postPosition);
      actualByHorseKey.set(horseKey, finishOrder);
    }
  }

  if (actualByHorseKey.size === 0) {
    log.debug(`MAE: race ${raceId} has no finish orders yet`);
    return null;
  }

  const candidates = stored.horses
    .filter(predicted => predicted.isEstimated !== true)
    .map(predicted => {
      const horseKey = predicted.horseKey ?? makeHorseKey(
        raceId,
        predicted.horseId,
        predicted.startNumber ?? predicted.postPosition
      );
      const actualFinishOrder = actualByHorseKey.get(horseKey);
      return actualFinishOrder === undefined ? null : { predicted, horseKey, actualFinishOrder };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null);

  const predictedOrder = [...candidates].sort((a, b) => a.predicted.rank - b.predicted.rank);
  const actualOrder = [...candidates].sort((a, b) => a.actualFinishOrder - b.actualFinishOrder);
  const predictedRanks = new Map(predictedOrder.map((candidate, index) => [candidate.horseKey, index + 1]));
  const actualRanks = new Map(actualOrder.map((candidate, index) => [candidate.horseKey, index + 1]));

  const matched: HorseMAEEntry[] = predictedOrder.map(({ predicted, horseKey, actualFinishOrder }) => {
    const predictedRank = predictedRanks.get(horseKey)!;
    const eligibleActualRank = actualRanks.get(horseKey)!;
    return {
      horseKey,
      horseId: predicted.horseId,
      horseName: predicted.horseName,
      predictedRank,
      actualFinishOrder,
      eligibleActualRank,
      rankError: Math.abs(predictedRank - eligibleActualRank),
    };
  });

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
  /**
   * Mean rank error over races measured under the current definition. Null when every
   * stored race predates it — better no number than one averaged across two meanings.
   */
  meanRankError: number | null;
  /** Races contributing to meanRankError. */
  raceCount: number;
  /**
   * Mean horses actually evaluated per race. MAE is computed only over horses with a
   * real prediction and a clean finish, so this is the coverage behind the headline
   * number. It matters because both exclusions and rank compression make MAE *fall*
   * as coverage shrinks — a drop here means the accuracy figure got easier, not better.
   */
  meanHorsesEvaluated: number;
  /** Stored rows skipped because they predate the current metric definition. */
  excludedLegacyRaces: number;
  /**
   * Fraction of races where the rank-1 pick actually finished 1st (0–1). Win and top-3
   * read the literal finish position, whose meaning did not change with rank
   * compression, so these aggregate every stored race including legacy ones.
   */
  winRate: number;
  /** Fraction of races where rank-1 pick finished in top 3 (0–1) */
  top3Rate: number;
  /** Races contributing to winRate/top3Rate — all stored races, not just current ones. */
  hitRateRaceCount: number;
  /** Individual results, newest first */
  results: RaceMAEResult[];
}

/**
 * Rows written before rank compression landed hold a different measurement: error against
 * the literal finish position over every stored horse, rather than against a rank
 * compressed to the evaluated cohort. Averaging the two together produces a number that
 * describes neither. Compressed rows are the ones carrying `eligibleActualRank`.
 */
const usesCurrentMetricDefinition = (result: RaceMAEResult): boolean =>
  result.horses.every(horse => typeof horse.eligibleActualRank === 'number');

/** Read all stored MAE results and aggregate them. Returns null if none exist. */
export async function getAggregateMAEStats(): Promise<AggregateMAEStats | null> {
  const stored = await RaceAnalysisCache.getAllMAEResults();
  if (stored.length === 0) return null;

  const results = stored.filter(usesCurrentMetricDefinition);
  const excludedLegacyRaces = stored.length - results.length;
  if (excludedLegacyRaces > 0) {
    log.debug(
      `MAE: ${excludedLegacyRaces} stored race(s) predate rank compression — excluded from mean rank error`,
    );
  }

  const meanRankError = results.length > 0
    ? results.reduce((sum, r) => sum + r.meanRankError, 0) / results.length
    : null;

  let winnerHits = 0;
  let top3Hits = 0;
  for (const r of stored) {
    const top1 = r.horses.find(h => h.predictedRank === 1);
    if (top1) {
      if (top1.actualFinishOrder === 1) winnerHits++;
      if (top1.actualFinishOrder <= 3) top3Hits++;
    }
  }
  const winRate = winnerHits / stored.length;
  const top3Rate = top3Hits / stored.length;
  const meanHorsesEvaluated = results.length > 0
    ? results.reduce((sum, r) => sum + r.horseCount, 0) / results.length
    : 0;

  return {
    meanRankError,
    raceCount: results.length,
    meanHorsesEvaluated,
    excludedLegacyRaces,
    winRate,
    top3Rate,
    hitRateRaceCount: stored.length,
    results: stored,
  };
}
