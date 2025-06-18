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
import { V75CacheService, CachedV75Race, CachedV75Horse } from '../../../services/v75CacheService';

export interface V75HorseResult {
  raceNumber: number;
  raceId: string;
  horseId: number;
  horseName: string; // This should ALWAYS be a string
  postPosition: number;
  rawKmTime?: KmTime;
  modernNormalizedResult?: ModernKmNormalizedResult;
  driverName: string;
  track: string;
  distance: number;
  startMethod: string;
  // Enhanced statistics from race data
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
      setCurrentTask("Checking cache...");
      setProgress(5);
      
      console.log(`\n🎯 === V75 ANALYSIS START for ${date} ===`);
      
      // First check if we have cached data
      const cachedAnalysis = await V75CacheService.getAnalysis(date);
      
      if (cachedAnalysis) {
        console.log(`🚀 CACHE HIT! Loading V75 analysis from cache for ${date}`);
        setCurrentTask("Loading from cache...");
        setProgress(20);
        
        // Convert cached data back to V75RaceResult format with normalization
        const cachedResults = await convertCachedToResults(cachedAnalysis.races, weights);
        
        setV75Results(cachedResults);
        setProgress(100);
        setCurrentTask("V75 analysis loaded from cache!");
        
        toast({
          title: "V75 Analysis Loaded",
          description: `Instantly loaded ${cachedResults.length} races from cache with pre-calculated raw times.`,
        });
        
        return;
      }
      
      // No cache, proceed with full analysis
      console.log(`📥 No cache found, performing full V75 analysis for ${date}`);
      
      setCurrentTask("Checking for V75 games...");
      setProgress(10);
      
      // First, get the V75 game info to validate and get race IDs
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
      console.log(`📋 Race IDs: ${gameInfo.raceIds.join(', ')}`);
      
      setCurrentTask(`Found V75 game with ${gameInfo.raceIds.length} races. Fetching race data...`);
      setProgress(15);
      
      // Fetch detailed race data using the identified race IDs
      let v75Races = await fetchV75RaceData(date);
      
      if (v75Races.length === 0) {
        const errorMsg = `Failed to fetch detailed race data for V75 game ${gameInfo.gameId}`;
        setError(errorMsg);
        toast({
          title: "Race Data Error",
          description: errorMsg,
          variant: "destructive",
        });
        return;
      }
      
      console.log(`📊 Successfully fetched ${v75Races.length}/7 V75 races`);
      setCurrentTask(`Successfully fetched ${v75Races.length} V75 races. Validating and fixing data...`);
      setProgress(20);
      
      // Apply validation and fixing to each race
      v75Races = await validateAndFixRaces(v75Races);
      
      setCurrentTask(`Data validation complete. Starting analysis...`);
      setProgress(25);
      
      const results: V75RaceResult[] = [];
      const cachedRaces: CachedV75Race[] = [];
      
      for (let i = 0; i < v75Races.length; i++) {
        const race = v75Races[i];
        const raceProgress = (i / v75Races.length) * 60;
        
        setCurrentTask(`Analyzing race ${race.raceNumber} (${i + 1} of ${v75Races.length})...`);
        setProgress(25 + raceProgress);
        
        try {
          const safeRaceTrack = extractTrackNameAsString(race.track);
          const safeRaceName = extractTrackNameAsString(race.name);
          
          console.log(`🏁 RACE ${race.raceNumber} - Track: "${safeRaceTrack}", Name: "${safeRaceName}"`);
          
          // Convert horses to ATG starts format for KM time calculation
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
          
          console.log(`\n=== 🔥 V75 Race ${race.raceNumber} Analysis ===`);
          console.log(`Race ID: ${race.raceId}`);
          console.log(`Track: ${safeRaceTrack}, Distance: ${race.distance}m`);
          console.log(`Horses to analyze: ${atgStarts.length}`);
          
          // Calculate RAW KM times
          setCurrentTask(`Race ${race.raceNumber}: Calculating RAW KM times...`);
          const rawKmTimes = await calculateRawKmTimesForRaceWithId(
            race.raceId, 
            atgStarts, 
            (current, total) => {
              const horseProgress = (current / total) * (60 / v75Races.length);
              setProgress(25 + raceProgress + horseProgress);
              setCurrentTask(`Race ${race.raceNumber}: Processing horse ${current} of ${total}...`);
            }
          );
          
          console.log(`📈 RAW KM times calculated for ${rawKmTimes.length} horses`);
          
          // Process horse results
          const horseResults = processHorseResults(race, rawKmTimes, weights);
          
          // Prepare cached race data
          const cachedHorses: CachedV75Horse[] = race.horses.map(horse => {
            const rawTimeData = rawKmTimes.find(rt => rt.horseId === horse.horseId);
            return {
              horseId: horse.horseId,
              horseName: typeof horse.name === 'string' ? horse.name : String(horse.name),
              postPosition: horse.postPosition,
              rawKmTime: rawTimeData?.best3Average,
              distance: horse.distance,
              startMethod: race.startMethod,
              driverName: `${horse.driver.firstName} ${horse.driver.lastName}`,
              statistics: {
                startPoints: horse.statistics.startPoints,
                placePercentage: horse.statistics.placePercentage,
                winPercentage: horse.statistics.winPercentage,
                earningsPerStart: horse.statistics.earningsPerStart,
              },
              driver2025WinPercentage: horse.driver.winPercentage2025,
              sulkyType: String(horse.sulky?.type || "VA"),
              shoesFront: Boolean(horse.shoes?.front),
              shoesBack: Boolean(horse.shoes?.back),
              homeTrack: typeof horse.homeTrack === 'string' ? horse.homeTrack : String(horse.homeTrack || 'Unknown')
            };
          });
          
          cachedRaces.push({
            raceNumber: race.raceNumber,
            raceId: race.raceId,
            track: safeRaceTrack,
            distance: race.distance,
            startMethod: race.startMethod,
            name: safeRaceName,
            prize: race.prize,
            horses: cachedHorses,
            cachedAt: new Date().toISOString()
          });
          
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
          
          console.log(`✅ Race ${race.raceNumber} analysis complete: ${horseResults.length} horses processed`);
          
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
      
      // Store the analysis in cache BEFORE setting results
      setCurrentTask("Storing analysis in cache...");
      setProgress(90);
      
      if (cachedRaces.length > 0) {
        await V75CacheService.storeAnalysis(date, gameInfo.gameId, cachedRaces);
        console.log(`💾 Analysis cached for future instant loading`);
      }
      
      setV75Results(results);
      setProgress(100);
      setCurrentTask("V75 analysis complete!");
      
      const successfulRaces = results.filter(r => r.analysisComplete).length;
      const totalHorses = results.reduce((sum, race) => sum + race.horses.length, 0);
      
      console.log(`\n🏁 === V75 ANALYSIS COMPLETE ===`);
      console.log(`📊 Successfully analyzed: ${successfulRaces}/${results.length} races`);
      console.log(`🐎 Total horses analyzed: ${totalHorses}`);
      console.log(`🎯 Game ID: ${gameInfo.gameId}`);
      console.log(`💾 Analysis cached for instant future loading`);
      
      toast({
        title: "V75 Analysis Complete",
        description: `Successfully analyzed ${successfulRaces} of ${results.length} races with ${totalHorses} horses for ${date}. Analysis cached for instant future loading.`,
      });
      
    } catch (err) {
      console.error("❌ Error during V75 analysis:", err);
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

  const convertCachedToResults = async (cachedRaces: CachedV75Race[], weights: NormalizationWeights): Promise<V75RaceResult[]> => {
    console.log(`🔄 Converting ${cachedRaces.length} cached races to results with current weights`);
    
    return cachedRaces.map(cachedRace => {
      const horseResults: V75HorseResult[] = cachedRace.horses.map(cachedHorse => {
        let modernNormalizedResult;

        if (cachedHorse.rawKmTime) {
          const factors: ModernNormalizationFactors = {
            postPosition: cachedHorse.postPosition,
            distance: cachedHorse.distance,
            raceDistance: cachedRace.distance,
            startMethod: cachedHorse.startMethod,
            shoesFront: cachedHorse.shoesFront ? "1" : "0",
            shoesBack: cachedHorse.shoesBack ? "1" : "0",
            sulkyType: cachedHorse.sulkyType || "VA",
            homeTrack: cachedHorse.homeTrack || "Unknown",
            driverExperience: 0,
            driverWinPercentage: 0,
            driverWinPercentage2025: cachedHorse.driver2025WinPercentage || 0,
            horseForm: cachedHorse.statistics?.winPercentage || 0,
            raceType: 'trot',
            timeOfDay: '',
            startPoints: cachedHorse.statistics?.startPoints || 500,
            placePercentage: cachedHorse.statistics?.placePercentage || 5000,
            horseWinPercentage: cachedHorse.statistics?.winPercentage || 1500,
            earningsPerStart: cachedHorse.statistics?.earningsPerStart || 300000
          };

          modernNormalizedResult = applyModernKmNormalization(cachedHorse.rawKmTime, factors, weights);
        }

        return {
          raceNumber: cachedRace.raceNumber,
          raceId: cachedRace.raceId,
          horseId: cachedHorse.horseId,
          horseName: cachedHorse.horseName,
          postPosition: cachedHorse.postPosition,
          rawKmTime: cachedHorse.rawKmTime,
          modernNormalizedResult,
          driverName: cachedHorse.driverName,
          track: cachedRace.track,
          distance: cachedHorse.distance,
          startMethod: cachedHorse.startMethod,
          statistics: cachedHorse.statistics,
          driver2025WinPercentage: cachedHorse.driver2025WinPercentage,
          sulkyType: cachedHorse.sulkyType,
          shoesFront: cachedHorse.shoesFront,
          shoesBack: cachedHorse.shoesBack,
          homeTrack: cachedHorse.homeTrack
        };
      });

      return {
        raceNumber: cachedRace.raceNumber,
        raceId: cachedRace.raceId,
        track: cachedRace.track,
        distance: cachedRace.distance,
        startMethod: cachedRace.startMethod,
        name: cachedRace.name,
        prize: cachedRace.prize,
        horses: horseResults,
        analysisComplete: true
      };
    });
  };

  const reanalyzeWithNewWeights = (weights: NormalizationWeights) => {
    if (v75Results.length === 0 || !analysisDate) return;
    
    console.log('🔄 Re-applying modern normalization with updated weights...');
    
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
