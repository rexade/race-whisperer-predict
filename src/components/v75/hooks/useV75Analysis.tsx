
import { useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { fetchV75RaceData, fetchV75GameInfo } from '../../../services/v75CalendarApi';
import { calculateRawKmTimesForRaceWithId } from '../../../services/kmTimeProcessor';
import { 
  applyModernKmNormalization,
  NormalizationWeights,
  ModernNormalizationFactors
} from '../../../services/modernKm/index';
import { ModernKmNormalizedResult, KmTime } from '../../../services/types/kmTimeTypes';
import { useV75DataValidation } from './useV75DataValidation';
import { processHorseResults } from '../utils/horseResultProcessor';
import { extractTrackNameAsString } from '../utils/dataExtraction';
import { V75CacheService } from '../../../services/v75CacheService';

export interface V75HorseResult {
  raceNumber: number;
  raceId: string;
  horseId: number;
  horseName: string;
  postPosition: number;
  rawKmTime?: KmTime;
  modernNormalizedResult?: ModernKmNormalizedResult;
  driverName: string;
  track: string;
  distance: number;
  startMethod: string;
  statistics?: {
    startPoints: number;
    placePercentage: number;
    winPercentage: number;
    earningsPerStart: number;
  };
  driver2025WinPercentage?: number;
  sulkyType?: string;
  shoesFront?: boolean;
  shoesBack?: boolean;
  homeTrack?: string;
}

export interface V75RaceResult {
  raceNumber: number;
  raceId: string;
  track: string;
  distance: number;
  startMethod: string;
  name: string;
  prize: number;
  horses: V75HorseResult[];
  analysisComplete: boolean;
}

export const useV75Analysis = () => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTask, setCurrentTask] = useState("");
  const [error, setError] = useState("");
  const [v75Results, setV75Results] = useState<V75RaceResult[]>([]);
  const [analysisDate, setAnalysisDate] = useState<string>("");
  const { toast } = useToast();
  const { validateAndFixRaces } = useV75DataValidation();

  const analyzeV75Date = async (date: string, weights: NormalizationWeights) => {
    setLoading(true);
    setError("");
    setProgress(0);
    setAnalysisDate(date);
    
    try {
      console.log(`\n🎯 === V75 OPTIMIZED ANALYSIS START for ${date} ===`);
      console.log(`🚀 Strategy: Cache only raw KM times, fetch fresh race data`);
      
      setCurrentTask("Checking for V75 games...");
      setProgress(5);
      
      // Get V75 game info
      const gameInfo = await fetchV75GameInfo(date);
      
      if (!gameInfo) {
        const errorMsg = `No V75 games found for ${date}. Please select a different date with V75 races.`;
        setError(errorMsg);
        toast({
          title: "No V75 Games Found",
          description: errorMsg,
          variant: "destructive",
        });
        return;
      }
      
      console.log(`✅ V75 Game confirmed: ${gameInfo.gameId}`);
      
      setCurrentTask(`Fetching fresh race data for ${gameInfo.raceIds.length} races...`);
      setProgress(10);
      
      // Always fetch FRESH race data from API
      let v75Races = await fetchV75RaceData(date);
      
      if (v75Races.length === 0) {
        const errorMsg = `Failed to fetch race data for V75 game ${gameInfo.gameId}`;
        setError(errorMsg);
        toast({
          title: "Race Data Error",
          description: errorMsg,
          variant: "destructive",
        });
        return;
      }
      
      console.log(`📊 Successfully fetched FRESH data for ${v75Races.length}/7 V75 races`);
      
      setCurrentTask("Validating race data...");
      setProgress(15);
      
      // Apply validation and fixing
      v75Races = await validateAndFixRaces(v75Races);
      
      setCurrentTask("Starting optimized analysis with raw time caching...");
      setProgress(20);
      
      const results: V75RaceResult[] = [];
      
      for (let i = 0; i < v75Races.length; i++) {
        const race = v75Races[i];
        const raceProgress = (i / v75Races.length) * 70;
        
        setCurrentTask(`Analyzing race ${race.raceNumber} (${i + 1} of ${v75Races.length})...`);
        setProgress(20 + raceProgress);
        
        try {
          const safeRaceTrack = extractTrackNameAsString(race.track);
          const safeRaceName = extractTrackNameAsString(race.name);
          
          console.log(`\n🏁 RACE ${race.raceNumber} - Optimized Analysis`);
          console.log(`Race ID: ${race.raceId}`);
          console.log(`Track: ${safeRaceTrack}, Distance: ${race.distance}m`);
          
          // Check for cached raw times FIRST
          const cachedRawTimes = await V75CacheService.getRawTimes(race.raceId);
          let rawKmTimes;
          
          if (cachedRawTimes) {
            console.log(`🚀 CACHE HIT! Using cached raw times for race ${race.raceNumber}`);
            setCurrentTask(`Race ${race.raceNumber}: Using cached raw times...`);
            
            // Convert cached raw times to expected format
            rawKmTimes = cachedRawTimes.rawTimes.map(cached => ({
              horseId: cached.horseId,
              best3Average: cached.rawKmTime
            }));
            
            console.log(`✅ Loaded ${rawKmTimes.length} cached raw times for race ${race.raceNumber}`);
          } else {
            console.log(`📊 No cache found, calculating raw times for race ${race.raceNumber}`);
            setCurrentTask(`Race ${race.raceNumber}: Calculating raw KM times...`);
            
            // Calculate raw times from scratch
            const atgStarts = race.horses.map(horse => ({
              horse: { 
                id: horse.horseId, 
                name: typeof horse.name === 'string' ? horse.name : String(horse.name)
              },
              number: horse.postPosition,
              postPosition: horse.postPosition,
              distance: horse.distance,
              driver: {
                firstName: horse.driver.firstName,
                lastName: horse.driver.lastName,
                statistics: { winPercentage: horse.driver.winPercentage }
              }
            }));
            
            rawKmTimes = await calculateRawKmTimesForRaceWithId(
              race.raceId, 
              atgStarts, 
              (current, total) => {
                const horseProgress = (current / total) * (70 / v75Races.length);
                setProgress(20 + raceProgress + horseProgress);
                setCurrentTask(`Race ${race.raceNumber}: Processing horse ${current} of ${total}...`);
              }
            );
            
            console.log(`📈 RAW KM times calculated for ${rawKmTimes.length} horses`);
            
            // Cache the raw times for future use
            setCurrentTask(`Race ${race.raceNumber}: Caching raw times...`);
            await V75CacheService.storeRawTimes(
              date,
              gameInfo.gameId,
              race.raceId,
              race.raceNumber,
              rawKmTimes
            );
            
            console.log(`💾 Raw times cached for race ${race.raceNumber}`);
          }
          
          // Process horse results with FRESH race data and cached/calculated raw times
          setCurrentTask(`Race ${race.raceNumber}: Processing results with fresh data...`);
          const horseResults = processHorseResults(race, rawKmTimes, weights);
          
          results.push({
            raceNumber: race.raceNumber,
            raceId: race.raceId,
            track: safeRaceTrack,
            distance: race.distance,
            startMethod: race.startMethod,
            name: safeRaceName,
            prize: race.prize,
            horses: horseResults,
            analysisComplete: true
          });
          
          console.log(`✅ Race ${race.raceNumber} optimized analysis complete: ${horseResults.length} horses processed`);
          
        } catch (raceError) {
          console.error(`❌ Error analyzing race ${race.raceNumber}:`, raceError);
          
          const safeRaceTrack = extractTrackNameAsString(race.track);
          const safeRaceName = extractTrackNameAsString(race.name);
          
          results.push({
            raceNumber: race.raceNumber,
            raceId: race.raceId,
            track: safeRaceTrack,
            distance: race.distance,
            startMethod: race.startMethod,
            name: safeRaceName,
            prize: race.prize,
            horses: [],
            analysisComplete: false
          });
        }
      }
      
      setV75Results(results);
      setProgress(100);
      setCurrentTask("V75 optimized analysis complete!");
      
      const successfulRaces = results.filter(r => r.analysisComplete).length;
      const totalHorses = results.reduce((sum, race) => sum + race.horses.length, 0);
      
      console.log(`\n🏁 === V75 OPTIMIZED ANALYSIS COMPLETE ===`);
      console.log(`📊 Successfully analyzed: ${successfulRaces}/${results.length} races`);
      console.log(`🐎 Total horses analyzed: ${totalHorses}`);
      console.log(`🚀 Strategy: Cached raw times + fresh race data`);
      console.log(`💾 Raw times cached for future instant use`);
      
      toast({
        title: "V75 Analysis Complete",
        description: `Successfully analyzed ${successfulRaces} races with ${totalHorses} horses using optimized caching.`,
      });
      
    } catch (err) {
      console.error("❌ Error during V75 optimized analysis:", err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      
      setError(`V75 analysis failed: ${errorMessage}`);
      
      toast({
        title: "V75 Analysis Error",
        description: "Failed to complete V75 analysis. Check console for details.",
        variant: "destructive",
      });
    } finally {
      setTimeout(() => setLoading(false), 1000);
    }
  };

  const reanalyzeWithNewWeights = (weights: NormalizationWeights) => {
    if (v75Results.length === 0 || !analysisDate) return;
    
    console.log('🔄 Re-applying modern normalization with updated weights to fresh data...');
    
    const updatedResults = v75Results.map(race => {
      if (!race.analysisComplete || race.horses.length === 0) return race;
      
      const updatedHorses = race.horses.map(horse => {
        if (!horse.rawKmTime) return horse;
        
        if (typeof horse.horseName !== 'string') {
          console.error('🚨 CRITICAL ERROR during reanalysis - Horse name is not a string!', horse.horseName);
          throw new Error(`Horse name type error during reanalysis for horse ${horse.horseId}`);
        }
        
        const factors: ModernNormalizationFactors = {
          postPosition: horse.postPosition,
          distance: horse.distance,
          raceDistance: race.distance,
          startMethod: race.startMethod,
          shoesFront: horse.shoesFront ? "1" : "0",
          shoesBack: horse.shoesBack ? "1" : "0",
          sulkyType: horse.sulkyType || "VA",
          homeTrack: horse.homeTrack || "Unknown",
          driverExperience: 0,
          driverWinPercentage: 0,
          driverWinPercentage2025: horse.driver2025WinPercentage || 0,
          horseForm: horse.statistics?.winPercentage || 0,
          raceType: 'trot',
          timeOfDay: '',
          startPoints: horse.statistics?.startPoints || 500,
          placePercentage: horse.statistics?.placePercentage || 5000,
          horseWinPercentage: horse.statistics?.winPercentage || 1500,
          earningsPerStart: horse.statistics?.earningsPerStart || 300000
        };
        
        const modernNormalizedResult = applyModernKmNormalization(horse.rawKmTime, factors, weights);
        
        return {
          ...horse,
          modernNormalizedResult
        };
      });
      
      return {
        ...race,
        horses: updatedHorses
      };
    });
    
    setV75Results(updatedResults);
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
