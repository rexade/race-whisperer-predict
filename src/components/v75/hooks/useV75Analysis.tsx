import { useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { V75RaceData } from '../../../services/v75CalendarApi';
import { NormalizationWeights, PostPositionCurves } from '../../../services/modernKm/index';
import { useV75DataValidation } from './useV75DataValidation';
import { useV75Progress } from './useV75Progress';
import { useV75Cache } from './useV75Cache';
import { useV75ResultsProcessor } from './useV75ResultsProcessor';
import type { V75HorseResult, V75RaceResult } from '../types/raceResultTypes';
import { GAME_TYPE_LABELS, type GameType } from '@/config/game';
import { log } from '@/lib/logger';
import { V75CacheService } from '@/services/v75CacheService';
import { useAnalysisWorker } from './useAnalysisWorker';
import { RaceScoreCalculator } from '../services/raceScoreCalculator';
import {
  getDriverRatingsSnapshot,
  primeDriverRatingsIfMissing,
} from '@/services/calibration/driverRatingService';

// Re-export types using 'export type'
export type { V75HorseResult, V75RaceResult };

export const useV75Analysis = () => {
  const [analysisDate, setAnalysisDate] = useState<string>("");
  // The game the results on screen were produced from. The picker's `gameType`
  // is live state and changing it does not clear the results, so labelling the
  // results with it would caption a V85 card "V65" the moment the user browses.
  const [analysisGameType, setAnalysisGameType] = useState<GameType | null>(null);
  const { toast } = useToast();
  const { validateAndFixRaces } = useV75DataValidation();
  const { getOrCalculateRawTimes } = useV75Cache();
  const { start: startWorker, stop: stopWorker, run: runWorker } = useAnalysisWorker();

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
    reanalyzeWithNewWeights
  } = useV75ResultsProcessor();

  /**
   * Run the heavy analysis on already fetched race data
   * Now uses Web Workers to keep UI responsive
   */
  const runAnalysis = async (
    races: V75RaceData[],
    date: string,
    gameId: string,
    weights: NormalizationWeights,
    postPositionCurves: PostPositionCurves | undefined,
    gameType: GameType
  ) => {
    resetProgress();
    startProgress();
    setAnalysisDate(date);
    setAnalysisGameType(gameType);
    const gameLabel = GAME_TYPE_LABELS[gameType] ?? gameType;

    try {
      if (races.length === 0) {
        const errorMsg = `No race data provided for ${gameLabel} analysis`;
        setErrorState(errorMsg);
        return;
      }

      updateProgress(10, "Validating race data...");

      // Apply validation and fixing
      const validatedRaces = await validateAndFixRaces(races);

      updateProgress(20, "Starting optimized analysis with raw time caching...");

      // Start the shared worker
      startWorker();

      // Workers cannot access localStorage or the main thread's module cache.
      await primeDriverRatingsIfMissing(gameType);
      const driverRatings = getDriverRatingsSnapshot();

      const results: V75RaceResult[] = [];

      try {
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

          // Process race in reusable Web Worker
          updateProgress(20 + raceProgress + (70 / validatedRaces.length), `Race ${race.raceNumber}: Processing results...`);

          const payload = {
            race,
            rawKmTimes,
            weights,
            analysisDate: date,
            postPositionCurves,
            driverRatings,
          };

          const workerResult = await runWorker(payload) as { raceResult: V75RaceResult };
          const raceResult = workerResult.raceResult;
          if (!raceResult.analysisComplete) {
            throw new Error(`Race ${race.raceNumber} could not be analyzed`);
          }
          results.push(raceResult);

          // Cache the analysis result on main thread (after worker completes)
          const cacheDate = date || race.date || new Date().toISOString().split('T')[0];
          const analysisHorses = RaceScoreCalculator.prepareAnalysisData(raceResult.horses);

          V75CacheService.storeRaceAnalysis(
            race.raceId,
            race.raceNumber,
            cacheDate,
            analysisHorses
          ).catch(cacheError => {
            log.warn(`Race ${race.raceNumber} analysis cache write failed`, cacheError);
          });
        }
      } finally {
        // Ensure worker is always stopped, even if analysis fails
        stopWorker();
      }

      setV75Results(results);
      finishProgress();

      const successfulRaces = results.filter(r => r.analysisComplete).length;
      const totalHorses = results.reduce((sum, race) => sum + race.horses.length, 0);

      toast({
        title: `${gameLabel} Analysis Complete`,
        description: `Processed ${successfulRaces}/${results.length} races • ${totalHorses} horses`,
      });

    } catch (err) {
      log.error(`Error during ${gameLabel} analysis:`, err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      setErrorState(`${gameLabel} analysis failed: ${errorMessage}`);

      toast({
        title: `${gameLabel} Analysis Error`,
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
    analysisGameType,
    runAnalysis,
    reanalyzeWithNewWeights,
    clearError: resetProgress
  };
};
