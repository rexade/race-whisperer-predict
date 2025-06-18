
import { NormalizationWeights } from '../../../services/modernKm/index';

export interface V75ActualResult {
  raceId: string;
  raceNumber: number;
  finishOrder: Array<{
    position: number;
    horseId: number;
    horseName: string;
    postPosition: number;
    time: string; // Actual race time
    driver: string;
  }>;
  raceTime: string;
  weather?: string;
  track?: string;
  distance: number;
}

export interface V75PredictionAccuracy {
  horseId: number;
  horseName: string;
  postPosition: number;
  predictedScore: number;
  predictedRank: number;
  actualFinishPosition: number;
  rankDifference: number; // predicted rank - actual position
  wasTopPick: boolean; // was in top 3 predictions
  actuallyPlaced: boolean; // finished in top 3
  correctPrediction: boolean; // top pick that actually placed
}

export interface V75RaceAnalysis {
  raceId: string;
  raceNumber: number;
  raceDate: string;
  distance: number;
  actualResults: V75ActualResult;
  predictionAccuracy: V75PredictionAccuracy[];
  overallAccuracy: {
    topPicksCorrect: number; // how many top picks actually placed
    topPicksTotal: number;
    averageRankDifference: number;
    perfectPredictions: number; // exact position matches
  };
}

export interface V75PostRaceAnalysis {
  gameId: string;
  analysisDate: string;
  races: V75RaceAnalysis[];
  overallPerformance: {
    totalRaces: number;
    averageAccuracy: number;
    bestRaceAccuracy: number;
    worstRaceAccuracy: number;
    recommendedWeightAdjustments?: Partial<NormalizationWeights>;
  };
}
