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
import { V75CacheService } from '@/services/v75CacheService';
import type { WorkerResponse } from '@/workers/analysis.worker';
// @ts-ignore - Vite handles worker imports
import AnalysisWorker from '@/workers/analysis.worker?worker';

import { useAnalysisWorker } from './useAnalysisWorker';

// Re-export types using 'export type'
export type { V75HorseResult, V75RaceResult };

export const useV75Analysis = () => {
  const [analysisDate, setAnalysisDate] = useState<string>("");
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
    processRaceResult,
    reanalyzeWithNewWeights
  } = useV75ResultsProcessor();

  /**
   * Process a single race using Web Worker
   */
  const processRaceWithWorker = (
    race: any,
    rawKmTimes: any[],
    weights: NormalizationWeights,
    analysisDate: string,
    postPositionCurves?: PostPositionCurves
  ): Promise<V75RaceResult> => {
    return new Promise((resolve, reject) => {
      const worker = new AnalysisWorker();

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const message = event.data;

        if (message.type === 'RESULT') {
          worker.terminate();
          resolve(message.payload.raceResult);
        } else if (message.type === 'ERROR') {
          worker.terminate();
          reject(new Error(message.payload.message));
        }
      };

      worker.onerror = (error) => {
        worker.terminate();
        reject(error);
      };

      // Send analysis request to worker
      worker.postMessage({
        type: 'ANALYZE_RACE',
        payload: {
          race,
          rawKmTimes,
          weights,
          analysisDate,
          postPositionCurves
        }
      });
    });
  };

  /**
   * Run the heavy analysis on already fetched race data
   * Now uses Web Workers to keep UI responsive
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

        // Process race in Web Worker (keeps UI responsive)
        updateProgress(20 + raceProgress + (70 / validatedRaces.length), `Race ${race.raceNumber}: Processing results...`);

        const raceResult = await processRaceWithWorker(race, rawKmTimes, weights, date, postPositionCurves);
        results.push(raceResult);

        // Cache the analysis result on main thread (after worker completes)
        const cacheDate = date || race.date || new Date().toISOString().split('T')[0];
        const analysisHorses = raceResult.horses.map(h => ({
          horseId: h.horseId,
          horseName: h.horseName,
          postPosition: h.postPosition,
          finalScore: h.finalScore,
          rank: h.rank,
          predictedTime: h.predictedTime
        }));

        V75CacheService.storeRaceAnalysis(
          race.raceId,
          race.raceNumber,
          cacheDate,
          analysisHorses
        ).catch(() => {
          // Silently ignore cache storage errors
        });
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
