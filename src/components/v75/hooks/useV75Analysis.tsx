
import { useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { fetchV75RaceData, fetchV75GameInfo } from '../../../services/v75CalendarApi';
import { NormalizationWeights, PostPositionCurves } from '../../../services/modernKm/index';
import { useV75DataValidation } from './useV75DataValidation';
import { useV75Progress } from './useV75Progress';
import { useV75Cache } from './useV75Cache';
import { useV75ResultsProcessor } from './useV75ResultsProcessor';
import type { V75HorseResult, V75RaceResult } from '../types/raceResultTypes';

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

  const analyzeV75Date = async (date: string, weights: NormalizationWeights, postPositionCurves?: PostPositionCurves) => {
    resetProgress(); // Clear any previous errors
    startProgress();
    setAnalysisDate(date);
    
    try {
      
      
      updateProgress(5, "Checking for V75 games...");
      
      // Get V75 game info
      const gameInfo = await fetchV75GameInfo(date);
      
      if (!gameInfo) {
        const errorMsg = `No V85 games found for ${date}. Please select a different date with V85 races.`;
        setErrorState(errorMsg);
        toast({
          title: "No V85 Games Found",
          description: errorMsg,
          variant: "destructive",
        });
        return;
      }
      
      
      
      updateProgress(10, `Fetching fresh race data for ${gameInfo.raceIds.length} races...`);
      
      // Always fetch FRESH race data from API
      let v75Races = await fetchV75RaceData(date);
      
      if (v75Races.length === 0) {
        const errorMsg = `Failed to fetch race data for V85 game ${gameInfo.gameId}`;
        setErrorState(errorMsg);
        toast({
          title: "V85 Data Error",
          description: errorMsg,
          variant: "destructive",
        });
        return;
      }
      
      
      
      updateProgress(15, "Validating race data...");
      
      // Apply validation and fixing
      v75Races = await validateAndFixRaces(v75Races);
      
      updateProgress(20, "Starting optimized analysis with raw time caching...");
      
      const results: V75RaceResult[] = [];
      
      for (let i = 0; i < v75Races.length; i++) {
        const race = v75Races[i];
        const raceProgress = (i / v75Races.length) * 70;
        
        updateProgress(20 + raceProgress, `Analyzing race ${race.raceNumber} (${i + 1} of ${v75Races.length})...`);
        
        
        
        // Get cached or calculate raw times
        const { rawKmTimes, wasFromCache } = await getOrCalculateRawTimes(
          race,
          gameInfo,
          date,
          (current, total) => {
            const horseProgress = (current / total) * (70 / v75Races.length);
            updateProgress(20 + raceProgress + horseProgress, `Race ${race.raceNumber}: Processing horse ${current} of ${total}...`);
          }
        );
        
        if (wasFromCache) {
          updateProgress(20 + raceProgress + (70 / v75Races.length), `Race ${race.raceNumber}: Using cached raw times...`);
        } else {
          updateProgress(20 + raceProgress + (70 / v75Races.length), `Race ${race.raceNumber}: Caching raw times...`);
        }
        
        // Process horse results with FRESH race data and cached/calculated raw times
        // Pass the analysis date (race date) to ensure correct caching
        updateProgress(20 + raceProgress + (70 / v75Races.length), `Race ${race.raceNumber}: Processing results with fresh data...`);
        const raceResult = await processRaceResult(race, rawKmTimes, weights, date, postPositionCurves);
        results.push(raceResult);
        
        
      }
      
      setV75Results(results);
      finishProgress();
      
      const successfulRaces = results.filter(r => r.analysisComplete).length;
      const totalHorses = results.reduce((sum, race) => sum + race.horses.length, 0);
      
      
      
      toast({
        title: "V85 Analysis Complete",
        description: `Processed ${successfulRaces}/${results.length} races • ${totalHorses} horses`,
      });
      
    } catch (err) {
      console.error("Error during V85 analysis:", err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      
      setErrorState(`V85 analysis failed: ${errorMessage}`);
      
      toast({
        title: "V85 Analysis Error",
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
    analyzeV75Date,
    reanalyzeWithNewWeights,
    clearError: resetProgress
  };
};
