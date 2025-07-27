
import { useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { fetchV75RaceData, fetchV75GameInfo } from '../../../services/v75CalendarApi';
import { NormalizationWeights } from '../../../services/modernKm/index';
import { useV75DataValidation } from './useV75DataValidation';
import { useV75Progress } from './useV75Progress';
import { useV75Cache } from './useV75Cache';
import { useV75ResultsProcessor } from './useV75ResultsProcessor';
import { PostAnalysisReporter } from '../../../services/investigation/postAnalysisReporter';
import { EnhancedXanderDebugger } from '../../../services/investigation/enhancedXanderDebugger';
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
    finishProgress
  } = useV75Progress();

  const {
    v75Results,
    setV75Results,
    processRaceResult,
    reanalyzeWithNewWeights
  } = useV75ResultsProcessor();

  const analyzeV75Date = async (date: string, weights: NormalizationWeights) => {
    startProgress();
    setAnalysisDate(date);
    
    try {
      console.log(`\n🎯 === V75 OPTIMIZED ANALYSIS START for ${date} ===`);
      console.log(`🚀 Strategy: Cache only raw KM times, fetch fresh race data`);
      
      // 🔍 ENHANCED XANDER INVESTIGATION: Check if any race contains Xander before processing
      console.log(`🕵️ PRE-ANALYSIS: Checking for Xander in V75 races for ${date}...`);
      
      updateProgress(5, "Checking for V75 games...");
      
      // Get V75 game info
      const gameInfo = await fetchV75GameInfo(date);
      
      if (!gameInfo) {
        const errorMsg = `No V75 games found for ${date}. Please select a different date with V75 races.`;
        setErrorState(errorMsg);
        toast({
          title: "No V75 Games Found",
          description: errorMsg,
          variant: "destructive",
        });
        return;
      }
      
      console.log(`✅ V75 Game confirmed: ${gameInfo.gameId}`);
      
      updateProgress(10, `Fetching fresh race data for ${gameInfo.raceIds.length} races...`);
      
      // Always fetch FRESH race data from API
      let v75Races = await fetchV75RaceData(date);
      
      if (v75Races.length === 0) {
        const errorMsg = `Failed to fetch race data for V75 game ${gameInfo.gameId}`;
        setErrorState(errorMsg);
        toast({
          title: "Race Data Error",
          description: errorMsg,
          variant: "destructive",
        });
        return;
      }
      
      console.log(`📊 Successfully fetched FRESH data for ${v75Races.length}/7 V75 races`);
      
      updateProgress(15, "Validating race data...");
      
      // Apply validation and fixing
      v75Races = await validateAndFixRaces(v75Races);
      
      // 🔍 ENHANCED XANDER INVESTIGATION: Check for Xander across all races
      const xanderRaces = v75Races.filter(race => 
        race.horses.some(horse => horse.name && typeof horse.name === 'string' && horse.name.toLowerCase().includes('xander'))
      );
      
      if (xanderRaces.length > 0) {
        console.log(`🕵️ ENHANCED DEBUGGING: Xander found in ${xanderRaces.length} V75 race(s) for ${date}`);
        xanderRaces.forEach(race => {
          const xanderHorse = race.horses.find(horse => horse.name && typeof horse.name === 'string' && horse.name.toLowerCase().includes('xander'));
          if (xanderHorse) {
            console.log(`🕵️ Race ${race.raceNumber}: Xander (${xanderHorse.name}) at position ${xanderHorse.postPosition}`);
            
            // Enable enhanced debugging for this V75 session
            EnhancedXanderDebugger.enableXanderDebugging(
              xanderHorse.name, 
              `v75_${date}_race${race.raceNumber}_${Date.now()}`
            );
            
            EnhancedXanderDebugger.addCheckpoint(
              'v75_analysis_start',
              'v75_initialization',
              xanderHorse.name,
              {
                analysisDate: date,
                gameId: gameInfo.gameId,
                raceNumber: race.raceNumber,
                raceId: race.raceId,
                postPosition: xanderHorse.postPosition,
                totalV75Races: v75Races.length
              },
              true
            );
          }
        });
      }
      
      updateProgress(20, "Starting optimized analysis with raw time caching...");
      
      const results: V75RaceResult[] = [];
      
      for (let i = 0; i < v75Races.length; i++) {
        const race = v75Races[i];
        const raceProgress = (i / v75Races.length) * 70;
        
        updateProgress(20 + raceProgress, `Analyzing race ${race.raceNumber} (${i + 1} of ${v75Races.length})...`);
        
        console.log(`\n🏁 RACE ${race.raceNumber} - Optimized Analysis`);
        console.log(`Race ID: ${race.raceId}`);
        
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
        const raceResult = await processRaceResult(race, rawKmTimes, weights, date);
        results.push(raceResult);
        
        console.log(`✅ Race ${race.raceNumber} optimized analysis complete: ${raceResult.horses.length} horses processed`);
      }
      
      setV75Results(results);
      finishProgress();
      
      const successfulRaces = results.filter(r => r.analysisComplete).length;
      const totalHorses = results.reduce((sum, race) => sum + race.horses.length, 0);
      
      console.log(`\n🏁 === V75 OPTIMIZED ANALYSIS COMPLETE ===`);
      console.log(`📊 Successfully analyzed: ${successfulRaces}/${results.length} races`);
      console.log(`🐎 Total horses analyzed: ${totalHorses}`);
      console.log(`🚀 Strategy: Cached raw times + fresh race data`);
      console.log(`💾 Raw times cached for future instant use`);
      console.log(`📅 Analysis cached with race date: ${date}`);
      
      // 🔍 ENHANCED XANDER INVESTIGATION: Finalize debugging if enabled
      if (EnhancedXanderDebugger.isDebugEnabled()) {
        console.log('🕵️ ENHANCED DEBUGGING: V75 analysis complete, generating final Xander investigation report...');
        
        // Find Xander's results across all races
        const xanderResults = results.flatMap(race => 
          race.horses.filter(horse => horse.horseName.toLowerCase().includes('xander'))
        );
        
        if (xanderResults.length > 0) {
          xanderResults.forEach(result => {
            EnhancedXanderDebugger.addCheckpoint(
              'v75_analysis_complete',
              'v75_completion',
              result.horseName,
              {
                finalPosition: result.rank,
                finalScore: result.finalScore,
                modernNormalizedResult: result.modernNormalizedResult ? 'available' : 'missing',
                rawKmTime: result.rawKmTime ? 'available' : 'missing',
                raceNumber: results.find(r => r.horses.includes(result))?.raceNumber || 'unknown',
                totalRacesAnalyzed: results.length
              },
              true
            );
          });
        }
        
        // Disable debugging and generate report
        EnhancedXanderDebugger.disableDebugging();
      }

      // Generate post-analysis report if debugging was enabled
      try {
        PostAnalysisReporter.generateReport();
      } catch (reportError) {
        console.log('📋 Post-analysis reporting not available:', reportError);
      }
      
      toast({
        title: "V75 Analysis Complete",
        description: `Successfully analyzed ${successfulRaces} races with ${totalHorses} horses using optimized caching.`,
      });
      
    } catch (err) {
      console.error("❌ Error during V75 optimized analysis:", err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      
      setErrorState(`V75 analysis failed: ${errorMessage}`);
      
      toast({
        title: "V75 Analysis Error",
        description: "Failed to complete V75 analysis. Check console for details.",
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
    reanalyzeWithNewWeights
  };
};
