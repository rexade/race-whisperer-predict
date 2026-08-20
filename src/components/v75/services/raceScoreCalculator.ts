
import { V75HorseResult } from '../types/raceResultTypes';
import { compareByRanking, rankingScoreSeconds } from '../utils/raceRanking';
import type { RaceAnalysisHorse } from '@/services/v75Cache/types';

const isValidPredictedTime = (time: unknown): time is { minutes: number; seconds: number; tenths: number } => {
  if (!time || typeof time !== 'object') return false;
  const parts = time as Record<string, unknown>;
  if (![parts.minutes, parts.seconds, parts.tenths].every(value => typeof value === 'number' && Number.isFinite(value))) {
    return false;
  }
  return (parts.minutes as number) * 60 + (parts.seconds as number) + (parts.tenths as number) / 10 > 0;
};

export class RaceScoreCalculator {
  /**
   * Calculate final scores and ranks for horses in a race
   * Now includes confidence-based tie-breaking and uncertainty penalty
   */
  static calculateScoresAndRanks(horses: V75HorseResult[]): V75HorseResult[] {
    // Calculate final scores for horses
    const horsesWithScores = horses.map((horse, index) => {
      const rankingScore = rankingScoreSeconds(horse);
      const finalScoreSeconds = Number.isFinite(rankingScore) ? rankingScore : 999;
      
      return {
        ...horse,
        finalScore: finalScoreSeconds,
        rank: index + 1
      };
    });

    horsesWithScores.sort(compareByRanking);
    
    horsesWithScores.forEach((horse, index) => {
      horse.rank = index + 1;
    });

    return horsesWithScores;
  }

  /**
   * Prepare horses data for analysis storage
   */
  static prepareAnalysisData(horses: V75HorseResult[]): RaceAnalysisHorse[] {
    return this.calculateScoresAndRanks(horses).map((horse, index) => {
      const normalizedTime = horse.modernNormalizedResult?.modernNormalizedTime;
      const isEstimated = horse.modernNormalizedResult?.isEstimated === true;
      const predictedTime = !isEstimated && isValidPredictedTime(normalizedTime)
        ? {
            minutes: normalizedTime.minutes,
            seconds: normalizedTime.seconds,
            tenths: normalizedTime.tenths,
          }
        : undefined;

      return {
        horseKey: horse.horseKey,
        horseId: horse.horseId,
        horseName: horse.horseName,
        startNumber: horse.startNumber ?? horse.postPosition,
        postPosition: horse.postPosition,
        finalScore: horse.finalScore ?? 999,
        rank: horse.rank ?? index + 1,
        isEstimated,
        predictedTime,
      };
    });
  }
}
