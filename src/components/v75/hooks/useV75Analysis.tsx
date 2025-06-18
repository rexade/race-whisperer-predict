
import { useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { fetchV75RaceData, fetchV75GameInfo, V75RaceData } from '../../../services/v75CalendarApi';
import { calculateRawKmTimesForRaceWithId } from '../../../services/kmTimeProcessor';
import { validateRaceData, fixRaceDataIssues } from '../../../services/raceDataValidator';
import { 
  applyModernKmNormalization,
  NormalizationWeights,
  ModernNormalizationFactors
} from '../../../services/modernKm/index';
import { ModernKmNormalizedResult, KmTime } from '../../../services/types/kmTimeTypes';
import { EnhancedRaceData, EnhancedHorseData } from '../../../services/enhancedAtgApi';

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

// CRITICAL: Enhanced safety function to ensure we never render an object as React child
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

// CRITICAL: Enhanced safety function for driver names
const extractDriverNameAsString = (driver: any): string => {
  console.log('🔍 EXTRACTING DRIVER NAME - Input:', JSON.stringify(driver), 'Type:', typeof driver);
  
  // If it's already a string, return it
  if (typeof driver === 'string') {
    console.log('✅ Driver name is already a string:', driver);
    return driver;
  }
  
  // If it's null or undefined
  if (!driver) {
    console.warn('⚠️ Driver is null/undefined, using fallback');
    return 'Unknown Driver';
  }
  
  // If it's an object with firstName and lastName
  if (typeof driver === 'object' && driver !== null) {
    console.log('🔧 Driver is an object, attempting to extract name:', JSON.stringify(driver));
    
    if ('firstName' in driver && 'lastName' in driver) {
      const firstName = typeof driver.firstName === 'string' ? driver.firstName : String(driver.firstName || '');
      const lastName = typeof driver.lastName === 'string' ? driver.lastName : String(driver.lastName || '');
      const fullName = `${firstName} ${lastName}`.trim();
      console.log('✅ Extracted driver name from firstName/lastName:', fullName);
      return fullName || 'Unknown Driver';
    }
    
    // If it's an object with name property
    if ('name' in driver && typeof driver.name === 'string') {
      console.log('✅ Extracted driver name from object.name:', driver.name);
      return driver.name;
    }
    
    console.error('❌ Driver is an object but no valid name found:', JSON.stringify(driver));
    return 'Unknown Driver';
  }
  
  // Fallback for any other type
  console.warn('⚠️ Driver is unexpected type:', typeof driver, driver);
  return String(driver) || 'Unknown Driver';
};

// CRITICAL: Enhanced safety function for track names
const extractTrackNameAsString = (track: any): string => {
  console.log('🔍 EXTRACTING TRACK NAME - Input:', JSON.stringify(track), 'Type:', typeof track);
  
  // If it's already a string, return it
  if (typeof track === 'string') {
    console.log('✅ Track name is already a string:', track);
    return track;
  }
  
  // If it's null or undefined
  if (!track) {
    console.warn('⚠️ Track is null/undefined, using fallback');
    return 'Unknown Track';
  }
  
  // If it's an object with name property
  if (typeof track === 'object' && track !== null) {
    console.log('🔧 Track is an object, attempting to extract name:', JSON.stringify(track));
    
    if ('name' in track && typeof track.name === 'string') {
      console.log('✅ Extracted track name from object.name:', track.name);
      return track.name;
    }
    
    // If it's an object with id and name
    if ('id' in track && 'name' in track) {
      const nameValue = (track as any).name;
      if (typeof nameValue === 'string') {
        console.log('✅ Extracted track name from id/name object:', nameValue);
        return nameValue;
      }
    }
    
    console.error('❌ Track is an object but no valid name found:', JSON.stringify(track));
    return 'Unknown Track';
  }
  
  // Fallback for any other type
  console.warn('⚠️ Track is unexpected type:', typeof track, track);
  return String(track) || 'Unknown Track';
};

// Convert V75RaceData to EnhancedRaceData format for validation
const convertV75ToEnhancedRaceData = (v75Race: V75RaceData): EnhancedRaceData => {
  console.log(`🔄 Converting V75 race ${v75Race.raceNumber} to EnhancedRaceData format for validation`);
  
  const enhancedHorses: EnhancedHorseData[] = v75Race.horses.map(horse => ({
    horseId: horse.horseId,
    name: extractHorseNameAsString(horse.name),
    postPosition: horse.postPosition,
    distance: horse.distance,
    startMethod: v75Race.startMethod, // Add missing startMethod property
    driver: {
      firstName: horse.driver.firstName,
      lastName: horse.driver.lastName,
      experience: horse.driver.experience,
      winPercentage: horse.driver.winPercentage,
      winPercentage2025: horse.driver.winPercentage2025
    },
    statistics: {
      startPoints: horse.statistics.startPoints,
      placePercentage: horse.statistics.placePercentage,
      winPercentage: horse.statistics.winPercentage,
      earningsPerStart: horse.statistics.earningsPerStart
    },
    shoes: {
      front: horse.shoes.front,
      back: horse.shoes.back
    },
    sulky: {
      type: horse.sulky.type
    },
    homeTrack: horse.homeTrack
  }));

  return {
    raceId: v75Race.raceId,
    raceNumber: v75Race.raceNumber,
    distance: v75Race.distance,
    startMethod: v75Race.startMethod,
    track: extractTrackNameAsString(v75Race.track), // Fix: should be string, not object
    name: v75Race.name,
    date: v75Race.date,
    prize: v75Race.prize,
    horses: enhancedHorses,
    dataQuality: {
      hasValidPostPositions: true,
      duplicatePositions: [],
      missingData: []
      // Remove validationApplied property as it doesn't exist in the type
    }
  };
};

// Convert EnhancedRaceData back to V75RaceData format after validation
const convertEnhancedToV75RaceData = (enhancedRace: EnhancedRaceData): V75RaceData => {
  console.log(`🔄 Converting enhanced race ${enhancedRace.raceNumber} back to V75RaceData format`);
  
  return {
    raceId: enhancedRace.raceId,
    raceNumber: enhancedRace.raceNumber,
    distance: enhancedRace.distance,
    startMethod: enhancedRace.startMethod,
    track: enhancedRace.track, // Fix: already a string, no need to access .name
    name: enhancedRace.name,
    date: enhancedRace.date,
    prize: enhancedRace.prize,
    horses: enhancedRace.horses.map(horse => ({
      horseId: horse.horseId,
      name: horse.name,
      postPosition: horse.postPosition,
      distance: horse.distance,
      driver: {
        firstName: horse.driver.firstName,
        lastName: horse.driver.lastName,
        experience: horse.driver.experience,
        winPercentage: horse.driver.winPercentage,
        winPercentage2025: horse.driver.winPercentage2025
      },
      statistics: {
        startPoints: horse.statistics.startPoints,
        placePercentage: horse.statistics.placePercentage,
        winPercentage: horse.statistics.winPercentage,
        earningsPerStart: horse.statistics.earningsPerStart
      },
      shoes: {
        front: horse.shoes.front,
        back: horse.shoes.back
      },
      sulky: {
        type: horse.sulky.type
      },
      homeTrack: horse.homeTrack
    }))
  };
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
      
      // NEW: Apply validation and fixing to each race
      console.log(`\n🔧 === APPLYING DATA VALIDATION AND FIXES ===`);
      const fixedV75Races: V75RaceData[] = [];
      
      for (let i = 0; i < v75Races.length; i++) {
        const race = v75Races[i];
        console.log(`\n--- 🔍 Validating race ${race.raceNumber} ---`);
        
        // Convert to EnhancedRaceData format for validation
        const enhancedRace = convertV75ToEnhancedRaceData(race);
        
        // Validate the race data
        const validation = validateRaceData(enhancedRace);
        
        if (!validation.isValid) {
          console.log(`⚠️ Race ${race.raceNumber} has validation issues:`, validation.errors);
          console.log(`🔧 Applying fixes for race ${race.raceNumber}...`);
          
          // Apply fixes
          const fixedEnhancedRace = fixRaceDataIssues(enhancedRace);
          
          // Convert back to V75RaceData format
          const fixedRace = convertEnhancedToV75RaceData(fixedEnhancedRace);
          
          console.log(`✅ Race ${race.raceNumber} fixed successfully`);
          fixedV75Races.push(fixedRace);
          
          // Show toast notification about the fix
          toast({
            title: `Race ${race.raceNumber} Fixed`,
            description: `Applied fixes for duplicate post positions`,
            variant: "default",
          });
        } else {
          console.log(`✅ Race ${race.raceNumber} validation passed - no fixes needed`);
          fixedV75Races.push(race);
        }
      }
      
      // Use the fixed races for analysis
      v75Races = fixedV75Races;
      console.log(`🏁 Data validation complete: ${v75Races.length} races ready for analysis`);
      
      setCurrentTask(`Data validation complete. Starting analysis...`);
      setProgress(20);
      
      const results: V75RaceResult[] = [];
      
      for (let i = 0; i < v75Races.length; i++) {
        const race = v75Races[i];
        const raceProgress = (i / v75Races.length) * 70;
        
        setCurrentTask(`Analyzing race ${race.raceNumber} (${i + 1} of ${v75Races.length})...`);
        setProgress(20 + raceProgress);
        
        try {
          // CRITICAL FIX: Ensure race.track and race.name are strings
          const safeRaceTrack = extractTrackNameAsString(race.track);
          const safeRaceName = extractTrackNameAsString(race.name);
          
          console.log(`🏁 RACE ${race.raceNumber} - Track: "${safeRaceTrack}" (${typeof safeRaceTrack}), Name: "${safeRaceName}" (${typeof safeRaceName})`);
          
          // Convert horses to ATG starts format for KM time calculation
          // CRITICAL FIX: We only pass the horse name as a string, not an object
          const atgStarts = race.horses.map(horse => {
            const horseName = extractHorseNameAsString(horse.name);
            console.log(`🐎 Processing horse: ${horseName} (ID: ${horse.horseId}) - Post Position: ${horse.postPosition}`);
            
            return {
              horse: { 
                id: horse.horseId, 
                name: horseName // This ensures name is always a string
              },
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
          console.log(`Track: ${safeRaceTrack}, Distance: ${race.distance}m`);
          console.log(`Horses to analyze: ${atgStarts.length}`);
          console.log(`Post positions: ${atgStarts.map(s => s.postPosition).sort().join(', ')}`);
          
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
            
            // CRITICAL: Extract ALL string fields as strings to prevent object rendering - TRIPLE CHECK
            const safeHorseName = extractHorseNameAsString(horse.name);
            const safeDriverName = extractDriverNameAsString(horse.driver);
            const safeHorseTrack = extractTrackNameAsString(horse.homeTrack);
            
            console.log(`🛡️ FINAL SAFETY CHECK - Horse ${horse.horseId}:`);
            console.log(`  - Horse name: "${safeHorseName}" (type: ${typeof safeHorseName})`);
            console.log(`  - Driver name: "${safeDriverName}" (type: ${typeof safeDriverName})`);
            console.log(`  - Home track: "${safeHorseTrack}" (type: ${typeof safeHorseTrack})`);
            console.log(`  - Post position: ${horse.postPosition}`);
            
            // Validate that ALL critical string fields are actually strings
            if (typeof safeHorseName !== 'string') {
              console.error(`🚨 CRITICAL ERROR - Horse name is not a string after extraction! Type: ${typeof safeHorseName}, Value:`, safeHorseName);
              throw new Error(`Horse name extraction failed for horse ${horse.horseId}`);
            }
            
            if (typeof safeDriverName !== 'string') {
              console.error(`🚨 CRITICAL ERROR - Driver name is not a string after extraction! Type: ${typeof safeDriverName}, Value:`, safeDriverName);
              throw new Error(`Driver name extraction failed for horse ${horse.horseId}`);
            }
            
            if (typeof safeHorseTrack !== 'string') {
              console.error(`🚨 CRITICAL ERROR - Home track is not a string after extraction! Type: ${typeof safeHorseTrack}, Value:`, safeHorseTrack);
              throw new Error(`Home track extraction failed for horse ${horse.horseId}`);
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
                homeTrack: safeHorseTrack, // Use the safe string version
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
            
            // CRITICAL: Create the result object with GUARANTEED string values
            const horseResult: V75HorseResult = {
              raceNumber: race.raceNumber,
              raceId: race.raceId,
              horseId: horse.horseId,
              horseName: safeHorseName, // GUARANTEED to be a string now
              postPosition: horse.postPosition,
              rawKmTime,
              modernNormalizedResult,
              driverName: safeDriverName, // GUARANTEED to be a string now
              track: safeRaceTrack, // GUARANTEED to be a string now
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
              homeTrack: safeHorseTrack
            };
            
            // FINAL VALIDATION: Double check that critical fields are strings
            console.log(`🔒 FINAL VALIDATION - Horse ${horse.horseId}:`, {
              horseName: horseResult.horseName,
              horseNameType: typeof horseResult.horseName,
              driverName: horseResult.driverName,
              driverNameType: typeof horseResult.driverName,
              track: horseResult.track,
              trackType: typeof horseResult.track,
              homeTrack: horseResult.homeTrack,
              homeTrackType: typeof horseResult.homeTrack,
              postPosition: horseResult.postPosition
            });
            
            horseResults.push(horseResult);
          }
          
          results.push({
            raceNumber: race.raceNumber,
            raceId: race.raceId,
            track: safeRaceTrack, // Use safe string version
            distance: race.distance,
            startMethod: race.startMethod,
            name: safeRaceName, // Use safe string version
            prize: race.prize,
            horses: horseResults,
            analysisComplete: true
          });
          
          console.log(`✅ Race ${race.raceNumber} analysis complete: ${horseResults.length} horses processed`);
          
        } catch (raceError) {
          console.error(`❌ Error analyzing race ${race.raceNumber}:`, raceError);
          
          // Add race with error state - ensure even error states use safe strings
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
      console.log(`🔧 Data validation and fixes applied to all races`);
      
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
        
        // ENSURE horse name is still a string during reanalysis
        console.log(`🔄 Reanalysis - Horse ${horse.horseId} name: "${horse.horseName}" (type: ${typeof horse.horseName})`);
        
        // Additional safety check during reanalysis
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
