
import { useState, useCallback } from 'react';
import { NormalizationWeights, PostPositionCurves } from '../../../services/modernKm/index';
import { V75RaceResult } from '../types/raceResultTypes';
import { HorseRawKmTime } from '../../../services/types/kmTimeTypes';
import { RaceResultProcessor } from '../services/raceResultProcessor';
import { RaceReanalysisService } from '../services/raceReanalysisService';

export const useV75ResultsProcessor = () => {
  const [v75Results, setV75Results] = useState<V75RaceResult[]>([]);

  const processRaceResult = useCallback(async (
    race: any,
    rawKmTimes: HorseRawKmTime[],
    weights: NormalizationWeights,
    analysisDate?: string,
    postPositionCurves?: PostPositionCurves
  ): Promise<V75RaceResult> => {
    return await RaceResultProcessor.processRaceResult(race, rawKmTimes, weights, analysisDate, postPositionCurves);
  }, []);

  const reanalyzeWithNewWeights = (weights: NormalizationWeights, postPositionCurves?: PostPositionCurves) => {
    const updatedResults = RaceReanalysisService.reanalyzeWithNewWeights(v75Results, weights, postPositionCurves);
    setV75Results(updatedResults);
  };

  return {
    v75Results,
    setV75Results,
    processRaceResult,
    reanalyzeWithNewWeights
  };
};
