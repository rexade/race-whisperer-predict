
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
      setCurrentTask("Checking for V75 games...");
      setProgress(5);
      
      console.log(`\n🎯 === V75 ANALYSIS START for ${date} ===`);
      
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
      setProgress(10);
      
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
      setProgress(15);
      
      // Apply validation and fixing to each race
      v75Races = await validateAndFixRaces(v75Races);
      
      setCurrentTask(`Data validation complete. Starting analysis...`);
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
              const horseProgress = (current / total) * (70 / v75Races.length);
              setProgress(20 + raceProgress + horseProgress);
              setCurrentTask(`Race ${race.raceNumber}: Processing horse ${current} of ${total}...`);
            }
          );
          
          console.log(`📈 RAW KM times calculated for ${rawKmTimes.length} horses`);
          
          // Process horse results
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
      
      setV75Results(results);
      setProgress(100);
      setCurrentTask("V75 analysis complete!");
      
      const successfulRaces = results.filter(r => r.analysisComplete).length;
      const totalHorses = results.reduce((sum, race) => sum + race.horses.length, 0);
      
      console.log(`\n🏁 === V75 ANALYSIS COMPLETE ===`);
      console.log(`📊 Successfully analyzed: ${successfulRaces}/${results.length} races`);
      console.log(`🐎 Total horses analyzed: ${totalHorses}`);
      console.log(`🎯 Game ID: ${gameInfo.gameId}`);
      
      toast({
        title: "V75 Analysis Complete",
        description: `Successfully analyzed ${successfulRaces} of ${results.length} races with ${totalHorses} horses for ${date}. Data validation applied.`,
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
