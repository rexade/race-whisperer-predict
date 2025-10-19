
import { V75HorseResult } from '../types/raceResultTypes';

export class RaceScoreCalculator {
  /**
   * Calculate final scores and ranks for horses in a race
   * Now includes confidence-based tie-breaking and uncertainty penalty
   */
  static calculateScoresAndRanks(horses: V75HorseResult[]): V75HorseResult[] {
    // Calculate final scores for horses
    const horsesWithScores = horses.map((horse, index) => {
      let finalScoreSeconds = 999;
      
      if (horse.modernNormalizedResult?.modernNormalizedTime) {
        const time = horse.modernNormalizedResult.modernNormalizedTime;
        finalScoreSeconds = time.minutes * 60 + time.seconds + time.tenths / 10;
        
        // Apply small penalty for uncertain predictions
        const penalty = horse.uncertain ? 0.20 : 0; // 0.20s/km penalty
        finalScoreSeconds += penalty;
      }
      
      return {
        ...horse,
        finalScore: finalScoreSeconds,
        rank: index + 1
      };
    });

    // Sort by final score, then by confidence (higher confidence wins ties)
    horsesWithScores.sort((a, b) => {
      const scoreA = a.finalScore ?? 999;
      const scoreB = b.finalScore ?? 999;
      
      if (scoreA !== scoreB) {
        return scoreA - scoreB;
      }
      
      // Tie-breaker: higher confidence wins
      const confA = a.confidence ?? 0;
      const confB = b.confidence ?? 0;
      return confB - confA;
    });
    
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
