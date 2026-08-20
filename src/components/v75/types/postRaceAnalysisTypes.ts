
import { NormalizationWeights } from '../../../services/modernKm/index';
import { KmTime } from '../../../services/types/kmTimeTypes';

/** Per-start post-race analytics from kmtid.atgx.se (optional; not in primary ATG API) */
export interface KmtidPerStartAnalytics {
  first200mPace?: string; // e.g. "1.28,1 min/km"
  last200mPace?: string;
  metersRun?: number;
  calculatedKmTime?: string;
  slipstreamMeters?: number;
  performanceGraphData?: Array<{ x: number; y: number } | { distance: number; value: number }>;
}

export interface V75ActualResult {
  raceId: string;
  raceNumber: number;
  finishOrder: Array<{
    position: number;
    horseKey?: string;
    horseId: number;
    horseName: string;
    startNumber?: number;
    postPosition: number;
    time: string; // Actual race time
    kmTime?: KmTime; // Parsed KM time object
    driver: string;
    /** Post-race analytics from kmtid.atgx.se when available */
    kmtidAnalytics?: KmtidPerStartAnalytics;
  }>;
  raceTime: string;
  weather?: string;
  track?: string;
  distance: number;
  bestTime?: KmTime; // Best actual time in the race
}

export interface V75PredictionAccuracy {
  horseKey?: string;
  horseId: number;
  horseName: string;
  postPosition: number;
  predictedScore: number;
  predictedRank: number;
  // Updated to match the actual cached format - plain object instead of KmTime interface
  predictedTime?: { minutes: number; seconds: number; tenths: number };
  actualFinishPosition: number;
  actualTime?: KmTime; // Actual finish time
  timeDifference?: number; // Seconds difference between predicted and actual
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
    meanAbsoluteError: number; // MAE for position predictions
    timeMAE?: number; // MAE for time predictions in seconds
    bestTimeAccuracy?: {
      predictedBest: string; // Horse name with best predicted time
      actualBest: string; // Horse name with actual best time
      correctBestPrediction: boolean; // Did we predict the fastest horse correctly?
    };
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
    overallMAE: number; // Overall position MAE across all races
    overallTimeMAE?: number; // Overall time MAE across all races
    bestTimesPredicted: number; // How many race winners we predicted correctly
    recommendedWeightAdjustments?: Partial<NormalizationWeights>;
  };
}
