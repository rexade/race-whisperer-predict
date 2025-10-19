
import { useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { fetchV85RaceData, fetchV85GameInfo } from '../../../services/v85CalendarApi';
import { NormalizationWeights, PostPositionCurves } from '../../../services/modernKm/index';
import { useV85DataValidation } from './useV85DataValidation';
import { useV85Progress } from './useV85Progress';
import { useV85Cache } from './useV85Cache';
import { useV85ResultsProcessor } from './useV85ResultsProcessor';
import type { V85HorseResult, V85RaceResult } from '../types/raceResultTypes';

// Re-export types using 'export type'
export type { V85HorseResult, V85RaceResult };

export const useV85Analysis = () => {
  const [analysisDate, setAnalysisDate] = useState<string>("");
  const { toast } = useToast();
  const { validateAndFixRaces } = useV85DataValidation();
  const { getOrCalculateRawTimes } = useV85Cache();
  
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
  } = useV85Progress();

  const {
    v85Results,
    setV85Results,
    processRaceResult,
    reanalyzeWithNewWeights
  } = useV85ResultsProcessor();

  const analyzeV85Date = async (date: string, weights: NormalizationWeights, postPositionCurves?: PostPositionCurves) => {
    resetProgress(); // Clear any previous errors
    startProgress();
    setAnalysisDate(date);
    
    try {
      
      
      updateProgress(5, "Checking for V85 games...");
      
      // Get V85 game info
      const gameInfo = await fetchV85GameInfo(date);
      
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
      let v85Races = await fetchV85RaceData(date);
      
      if (v85Races.length === 0) {
        const errorMsg = `Failed to fetch race data for V85 game ${gameInfo.gameId}`;
        setErrorState(errorMsg);
        toast({
          title: "Race Data Error",
          description: errorMsg,
          variant: "destructive",
        });
        return;
      }
      
      
      
      updateProgress(15, "Validating race data...");
      
      // Apply validation and fixing
      v85Races = await validateAndFixRaces(v85Races);
      
      updateProgress(20, "Starting optimized analysis with raw time caching...");
      
      const results: V85RaceResult[] = [];
      
      for (let i = 0; i < v85Races.length; i++) {
        const race = v85Races[i];
        const raceProgress = (i / v85Races.length) * 70;
        
        updateProgress(20 + raceProgress, `Analyzing race ${race.raceNumber} (${i + 1} of ${v85Races.length})...`);
        
        
        
        // Get cached or calculate raw times
        const { rawKmTimes, wasFromCache } = await getOrCalculateRawTimes(
          race,
          gameInfo,
          date,
          (current, total) => {
            const horseProgress = (current / total) * (70 / v85Races.length);
            updateProgress(20 + raceProgress + horseProgress, `Race ${race.raceNumber}: Processing horse ${current} of ${total}...`);
          }
        );
        
        if (wasFromCache) {
          updateProgress(20 + raceProgress + (70 / v85Races.length), `Race ${race.raceNumber}: Using cached raw times...`);
        } else {
          updateProgress(20 + raceProgress + (70 / v85Races.length), `Race ${race.raceNumber}: Caching raw times...`);
        }
        
        // Process horse results with FRESH race data and cached/calculated raw times
        // Pass the analysis date (race date) to ensure correct caching
        updateProgress(20 + raceProgress + (70 / v85Races.length), `Race ${race.raceNumber}: Processing results with fresh data...`);
        const raceResult = await processRaceResult(race, rawKmTimes, weights, date, postPositionCurves);
        results.push(raceResult);
        
        
      }
      
      setV85Results(results);
      finishProgress();
      
      const successfulRaces = results.filter(r => r.analysisComplete).length;
      const totalHorses = results.reduce((sum, race) => sum + race.horses.length, 0);
      
      
      
      toast({
        title: "V85 Analysis Complete",
        description: `Successfully analyzed ${successfulRaces} races with ${totalHorses} horses using optimized caching.`,
      });
      
    } catch (err) {
      console.error("Error during V85 analysis:", err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      
      setErrorState(`V85 analysis failed: ${errorMessage}`);
      
      toast({
        title: "V85 Analysis Error",
        description: "Failed to complete V85 analysis. Check console for details.",
        variant: "destructive",
      });
    }
  };

  return {
    loading,
    progress,
    currentTask,
    error,
    v85Results,
    analysisDate,
    analyzeV85Date,
    reanalyzeWithNewWeights,
    clearError: resetProgress
  };
};
