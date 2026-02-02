import { useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { V75RaceData } from '../../../services/v75CalendarApi';
import { NormalizationWeights, PostPositionCurves } from '../../../services/modernKm/index';
import { useV75DataValidation } from './useV75DataValidation';
import { useV75Progress } from './useV75Progress';
import { useV75Cache } from './useV75Cache';
import { useV75ResultsProcessor } from './useV75ResultsProcessor';
import type { V75HorseResult, V75RaceResult } from '../types/raceResultTypes';
import { GAME_TYPE } from '@/config/game';
import { log } from '@/lib/logger';

// Re-export types using 'export type'
export type { V75HorseResult, V75RaceResult };

export const useV75Analysis = () => {
  const [analysisDate, setAnalysisDate] = useState<string>("");
  const { toast } = useToast();
  const { validateAndFixRaces } = useV75DataValidation();
  const { getOrCalculateRawTimes } = useV75Cache();

  const {
    loading,
    progress,
    currentTask,
    error,
    startProgress,
    updateProgress,
    setErrorState,
    finishProgress,
    resetProgress
  } = useV75Progress();

  const {
    v75Results,
    setV75Results,
    processRaceResult,
    reanalyzeWithNewWeights
  } = useV75ResultsProcessor();

  /**
   * Run the heavy analysis on already fetched race data
   */
  const runAnalysis = async (
    races: V75RaceData[],
    date: string,
    gameId: string,
    weights: NormalizationWeights,
    postPositionCurves?: PostPositionCurves
  ) => {
    resetProgress();
    startProgress();
    setAnalysisDate(date);

    try {
      if (races.length === 0) {
        const errorMsg = `No race data provided for ${GAME_TYPE} analysis`;
        setErrorState(errorMsg);
        return;
      }

      updateProgress(10, "Validating race data...");

      // Apply validation and fixing
      const validatedRaces = await validateAndFixRaces(races);

      updateProgress(20, "Starting optimized analysis with raw time caching...");

      const results: V75RaceResult[] = [];

      for (let i = 0; i < validatedRaces.length; i++) {
        const race = validatedRaces[i];
        const raceProgress = (i / validatedRaces.length) * 70;

        updateProgress(20 + raceProgress, `Analyzing race ${race.raceNumber} (${i + 1} of ${validatedRaces.length})...`);

        // Get cached or calculate raw times
        const { rawKmTimes, wasFromCache } = await getOrCalculateRawTimes(
          race,
          { gameId }, // Pass simple object with gameId
          date,
          (current, total) => {
            const horseProgress = (current / total) * (70 / validatedRaces.length);
            updateProgress(20 + raceProgress + horseProgress, `Race ${race.raceNumber}: Processing horse ${current} of ${total}...`);
          }
        );

        if (wasFromCache) {
          updateProgress(20 + raceProgress + (70 / validatedRaces.length), `Race ${race.raceNumber}: Using cached raw times...`);
        } else {
          updateProgress(20 + raceProgress + (70 / validatedRaces.length), `Race ${race.raceNumber}: Caching raw times...`);
        }

        // Process horse results with FRESH race data and cached/calculated raw times
        updateProgress(20 + raceProgress + (70 / validatedRaces.length), `Race ${race.raceNumber}: Processing results with fresh data...`);
        const raceResult = await processRaceResult(race, rawKmTimes, weights, date, postPositionCurves);
        results.push(raceResult);
      }

      setV75Results(results);
      finishProgress();

      const successfulRaces = results.filter(r => r.analysisComplete).length;
      const totalHorses = results.reduce((sum, race) => sum + race.horses.length, 0);

      toast({
        title: `${GAME_TYPE} Analysis Complete`,
        description: `Processed ${successfulRaces}/${results.length} races • ${totalHorses} horses`,
      });

    } catch (err) {
      log.error(`Error during ${GAME_TYPE} analysis:`, err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      setErrorState(`${GAME_TYPE} analysis failed: ${errorMessage}`);

      toast({
        title: `${GAME_TYPE} Analysis Error`,
        description: "Check console for details.",
        variant: "destructive",
      });
    }
  };

  return {
    loading,
    progress,
    currentTask,
    error,
    v75Results,
    analysisDate,
    runAnalysis,
    reanalyzeWithNewWeights,
    clearError: resetProgress
  };
};
