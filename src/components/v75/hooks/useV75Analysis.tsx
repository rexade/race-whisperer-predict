
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

// Enhanced safety function to ensure we never render an object as React child
const extractHorseNameAsString = (horseName: any): string => {
  console.log('🔍 EXTRACTING HORSE NAME - Input:', JSON.stringify(horseName), 'Type:', typeof horseName);
  
  // If it's already a string, return it
  if (typeof horseName === 'string') {
    console.log('✅ Horse name is already a string:', horseName);
    return horseName;
  }
  
  // If it's null or undefined
  if (!horseName) {
    console.warn('⚠️ Horse name is null/undefined, using fallback');
    return 'Unknown Horse';
  }
  
  // If it's an object with name property
  if (typeof horseName === 'object' && horseName !== null) {
    console.log('🔧 Horse name is an object, attempting to extract name:', JSON.stringify(horseName));
    
    if ('name' in horseName && typeof horseName.name === 'string') {
      console.log('✅ Extracted name from object.name:', horseName.name);
      return horseName.name;
    }
    
    // If it's an object with id and name
    if ('id' in horseName && 'name' in horseName) {
      const nameValue = (horseName as any).name;
      if (typeof nameValue === 'string') {
        console.log('✅ Extracted name from id/name object:', nameValue);
        return nameValue;
      }
    }
    
    console.error('❌ Horse name is an object but no valid name found:', JSON.stringify(horseName));
    return 'Unknown Horse';
  }
  
  // Fallback for any other type
  console.warn('⚠️ Horse name is unexpected type:', typeof horseName, horseName);
  return String(horseName) || 'Unknown Horse';
};

export const useV75Analysis = () => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTask, setCurrentTask] = useState("");
  const [error, setError] = useState("");
  const [v75Results, setV75Results] = useState<V75RaceResult[]>([]);
  const [analysisDate, setAnalysisDate] = useState<string>("");
  const { toast } = useToast();

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
      const v75Races = await fetchV75RaceData(date);
      
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
      setCurrentTask(`Successfully fetched ${v75Races.length} V75 races. Starting analysis...`);
      setProgress(20);
      
      const results: V75RaceResult[] = [];
      
      for (let i = 0; i < v75Races.length; i++) {
        const race = v75Races[i];
        const raceProgress = (i / v75Races.length) * 70;
        
        setCurrentTask(`Analyzing race ${race.raceNumber} (${i + 1} of ${v75Races.length})...`);
        setProgress(20 + raceProgress);
        
        try {
          // Convert horses to ATG starts format for KM time calculation
          const atgStarts = race.horses.map(horse => {
            // CRITICAL: Ensure we get the horse name as a string - handle both string and object cases
            const horseName = extractHorseNameAsString(horse.name);
            console.log(`🐎 Processing horse: ${horseName} (ID: ${horse.horseId}) - Original name:`, JSON.stringify(horse.name));
            
            return {
              horse: { id: horse.horseId, name: horseName }, // This stays as object for internal processing
              number: horse.postPosition,
              postPosition: horse.postPosition,
              distance: horse.distance,
              driver: {
                firstName: horse.driver.firstName,
                lastName: horse.driver.lastName,
                statistics: { winPercentage: horse.driver.winPercentage }
              }
            };
          });
          
          console.log(`\n=== 🔥 V75 Race ${race.raceNumber} Analysis ===`);
          console.log(`Race ID: ${race.raceId}`);
          console.log(`Track: ${race.track}, Distance: ${race.distance}m`);
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
          
          // Apply modern normalization
          const horseResults: V75HorseResult[] = [];
          
          for (const horse of race.horses) {
            const rawTimeData = rawKmTimes.find(rt => rt.horseId === horse.horseId);
            const rawKmTime = rawTimeData?.best3Average;
            
            // CRITICAL: Extract horse name as string to prevent object rendering - DOUBLE CHECK
            const safeHorseName = extractHorseNameAsString(horse.name);
            console.log(`🛡️ FINAL SAFETY CHECK - Horse ${horse.horseId}: Setting name to "${safeHorseName}" (type: ${typeof safeHorseName})`);
            
            // Validate that safeHorseName is actually a string
            if (typeof safeHorseName !== 'string') {
              console.error(`🚨 CRITICAL ERROR - Horse name is not a string after extraction! Type: ${typeof safeHorseName}, Value:`, safeHorseName);
              throw new Error(`Horse name extraction failed for horse ${horse.horseId}`);
            }
            
            let modernNormalizedResult: ModernKmNormalizedResult | undefined;
            
            if (rawKmTime) {
              const factors: ModernNormalizationFactors = {
                postPosition: horse.postPosition,
                distance: horse.distance,
                raceDistance: race.distance,
                startMethod: race.startMethod,
                shoesFront: horse.shoes.front ? "1" : "0",
                shoesBack: horse.shoes.back ? "1" : "0",
                sulkyType: horse.sulky.type,
                homeTrack: horse.homeTrack,
                driverExperience: horse.driver.experience,
                driverWinPercentage: horse.driver.winPercentage,
                driverWinPercentage2025: horse.driver.winPercentage2025,
                horseForm: horse.statistics.winPercentage,
                raceType: 'trot',
                timeOfDay: '',
                startPoints: horse.statistics.startPoints,
                placePercentage: horse.statistics.placePercentage,
                horseWinPercentage: horse.statistics.winPercentage,
                earningsPerStart: horse.statistics.earningsPerStart
              };
              
              modernNormalizedResult = applyModernKmNormalization(rawKmTime, factors, weights);
            }
            
            horseResults.push({
              raceNumber: race.raceNumber,
              raceId: race.raceId,
              horseId: horse.horseId,
              horseName: safeHorseName, // GUARANTEED to be a string now
              postPosition: horse.postPosition,
              rawKmTime,
              modernNormalizedResult,
              driverName: `${horse.driver.firstName} ${horse.driver.lastName}`,
              track: race.track,
              distance: horse.distance,
              startMethod: race.startMethod,
              // Enhanced statistics
              statistics: {
                startPoints: horse.statistics.startPoints,
                placePercentage: horse.statistics.placePercentage,
                winPercentage: horse.statistics.winPercentage,
                earningsPerStart: horse.statistics.earningsPerStart,
              },
              driver2025WinPercentage: horse.driver.winPercentage2025,
              sulkyType: horse.sulky.type,
              shoesFront: horse.shoes.front,
              shoesBack: horse.shoes.back,
              homeTrack: horse.homeTrack
            });
          }
          
          results.push({
            raceNumber: race.raceNumber,
            raceId: race.raceId,
            track: race.track,
            distance: race.distance,
            startMethod: race.startMethod,
            name: race.name,
            prize: race.prize,
            horses: horseResults,
            analysisComplete: true
          });
          
          console.log(`✅ Race ${race.raceNumber} analysis complete: ${horseResults.length} horses processed`);
          
        } catch (raceError) {
          console.error(`❌ Error analyzing race ${race.raceNumber}:`, raceError);
          
          // Add race with error state
          results.push({
            raceNumber: race.raceNumber,
            raceId: race.raceId,
            track: race.track,
            distance: race.distance,
            startMethod: race.startMethod,
            name: race.name,
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
        description: `Successfully analyzed ${successfulRaces} of ${results.length} races with ${totalHorses} horses for ${date}`,
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
        
        // ENSURE horse name is still a string during reanalysis
        console.log(`🔄 Reanalysis - Horse ${horse.horseId} name: "${horse.horseName}" (type: ${typeof horse.horseName})`);
        
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
