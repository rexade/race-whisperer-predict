
import { V75HorseResult } from '../types/raceResultTypes';

export class RaceScoreCalculator {
  /**
   * Calculate final scores and ranks for horses in a race
   */
  static calculateScoresAndRanks(horses: V75HorseResult[]): V75HorseResult[] {
    // Calculate final scores for horses
    const horsesWithScores = horses.map((horse, index) => ({
      ...horse,
      finalScore: horse.modernNormalizedResult ? 
        (horse.modernNormalizedResult.modernNormalizedTime.minutes * 60 + 
         horse.modernNormalizedResult.modernNormalizedTime.seconds + 
         horse.modernNormalizedResult.modernNormalizedTime.tenths / 10) : 999,
      rank: index + 1
    }));

    // Sort by final score and update ranks
    horsesWithScores.sort((a, b) => a.finalScore - b.finalScore);
    horsesWithScores.forEach((horse, index) => {
      horse.rank = index + 1;
    });

    return horsesWithScores;
  }

  /**
   * Prepare horses data for analysis storage
   */
  static prepareAnalysisData(horses: V75HorseResult[]) {
    return horses.map(horse => ({
      horseId: horse.horseId,
      horseName: horse.horseName,
      postPosition: horse.postPosition,
      finalScore: horse.finalScore || 999,
      rank: horse.rank || 999
    }));
  }
}
