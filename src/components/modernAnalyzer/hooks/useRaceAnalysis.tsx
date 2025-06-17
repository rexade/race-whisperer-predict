
import { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { fetchEnhancedRaceData, EnhancedHorseData } from '../../../services/enhancedAtgApi';
import { calculateRawKmTimesForRaceWithId } from '../../../services/kmTimeProcessor';
import { validateRaceData, fixRaceDataIssues } from '../../../services/raceDataValidator';
import { 
  applyModernKmNormalization,
  NormalizationWeights,
  ModernNormalizationFactors
} from '../../../services/modernKmNormalization';
import { ModernKmNormalizedResult, KmTime } from '../../../services/types/kmTimeTypes';

// Enhanced horse data with KM time
interface EnhancedHorseDataWithKmTime extends EnhancedHorseData {
  rawKmTime?: KmTime;
}

export const useRaceAnalysis = () => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTask, setCurrentTask] = useState("");
  const [error, setError] = useState("");
  const [enhancedHorses, setEnhancedHorses] = useState<EnhancedHorseDataWithKmTime[]>([]);
  const [modernResults, setModernResults] = useState<ModernKmNormalizedResult[]>([]);
  const [raceInfo, setRaceInfo] = useState<any>(null);
  const { toast } = useToast();

  const applyModernNormalizationToHorses = (horses: EnhancedHorseDataWithKmTime[], raceData: any, weights: NormalizationWeights) => {
    const results: ModernKmNormalizedResult[] = [];
    
    console.log('\n=== Applying Enhanced Modern KM Normalization ===');
    console.log(`Race Distance: ${raceData.distance}m`);
    console.log(`Race Type: ${raceData.raceType || 'Not specified'}`);
    console.log(`Start Time: ${raceData.startTime || 'Not specified'}`);
    
    for (const horse of horses) {
      if (!horse.rawKmTime) continue;
      
      const factors: ModernNormalizationFactors = {
        postPosition: horse.postPosition,
        distance: horse.distance,
        raceDistance: raceData.distance,
        startMethod: horse.startMethod,
        shoesFront: horse.shoes.front ? "1" : "0",
        shoesBack: horse.shoes.back ? "1" : "0",
        sulkyType: horse.sulky.type,
        homeTrack: horse.homeTrack,
        driverExperience: horse.driver.experience,
        driverWinPercentage: horse.driver.winPercentage,
        driverWinPercentage2025: horse.driver.winPercentage2025,
        horseForm: horse.statistics.winPercentage,
        raceType: raceData.raceType,
        timeOfDay: raceData.startTime,
        startPoints: horse.statistics.startPoints,
        placePercentage: horse.statistics.placePercentage,
        horseWinPercentage: horse.statistics.winPercentage,
        earningsPerStart: horse.statistics.earningsPerStart
      };
      
      console.log(`\nProcessing ${horse.name}:`);
      console.log(`  Individual distance: ${factors.distance}m`);
      console.log(`  Race distance: ${factors.raceDistance}m`);
      console.log(`  Race type: ${factors.raceType || 'N/A'}`);
      console.log(`  Start time: ${factors.timeOfDay || 'N/A'}`);
      console.log(`  Start Points: ${factors.startPoints}`);
      console.log(`  Place %: ${factors.placePercentage}%`);
      console.log(`  Win %: ${factors.horseWinPercentage}%`);
      console.log(`  Earnings/Start: ${factors.earningsPerStart} öre`);
      
      const result = applyModernKmNormalization(horse.rawKmTime, factors, weights);
      results.push(result);
    }
    
    setModernResults(results);
  };

  const analyzeRace = async (raceId: string, weights: NormalizationWeights) => {
    setLoading(true);
    setError("");
    setProgress(0);
    
    try {
      setCurrentTask("Fetching enhanced race data...");
      setProgress(20);
      
      let raceData = await fetchEnhancedRaceData(raceId);
      
      const validation = validateRaceData(raceData);
      
      if (!validation.isValid) {
        console.warn('Race data has quality issues, attempting to fix...');
        
        toast({
          title: "Data Quality Issues Detected",
          description: `Found ${validation.errors.length} errors. Attempting automatic fixes...`,
          variant: "destructive",
        });
        
        raceData = fixRaceDataIssues(raceData);
        
        const finalValidation = validateRaceData(raceData);
        if (!finalValidation.isValid) {
          throw new Error(`Unable to fix race data issues: ${finalValidation.errors.join(', ')}`);
        }
        
        toast({
          title: "Data Issues Fixed",
          description: "Race data has been automatically corrected and is ready for analysis.",
        });
      }
      
      setRaceInfo(raceData);
      
      setCurrentTask("Calculating RAW KM times with historical data...");
      setProgress(50);
      
      const atgStarts = raceData.horses.map(horse => ({
        horse: { id: horse.horseId, name: horse.name },
        number: horse.postPosition,
        postPosition: horse.postPosition,
        distance: horse.distance,
        driver: {
          firstName: horse.driver.firstName,
          lastName: horse.driver.lastName,
          statistics: { winPercentage: horse.driver.winPercentage }
        }
      }));
      
      console.log('\n=== 🔥 STRICT MAPPING: Using POST POSITIONS for historical data fetch ===');
      atgStarts.forEach(start => {
        console.log(`Post Position ${start.postPosition}: ${start.horse.name} - WILL FETCH HISTORICAL DATA FROM /start/${start.postPosition}`);
      });
      
      const rawKmTimes = await calculateRawKmTimesForRaceWithId(raceId, atgStarts, (current, total) => {
        const progressValue = 50 + (current / total) * 30;
        setProgress(progressValue);
        setCurrentTask(`Fetching historical data for RAW KM time calculation: horse ${current} of ${total}...`);
      });
      
      const horsesWithRawKmTimes = raceData.horses.map(horse => {
        const rawTimeData = rawKmTimes.find(rt => rt.horseId === horse.horseId);
        return {
          ...horse,
          rawKmTime: rawTimeData?.best3Average || { minutes: 0, seconds: 0, tenths: 0 }
        };
      });
      
      setEnhancedHorses(horsesWithRawKmTimes);
      
      setCurrentTask("Applying enhanced modern KM normalization...");
      setProgress(80);
      
      applyModernNormalizationToHorses(horsesWithRawKmTimes, raceData, weights);
      
      setProgress(100);
      setCurrentTask("Enhanced KM analysis complete!");
      
      const horsesWithValidTimes = horsesWithRawKmTimes.filter(h => 
        h.rawKmTime && (h.rawKmTime.minutes > 0 || h.rawKmTime.seconds > 0 || h.rawKmTime.tenths > 0)
      ).length;
      
      toast({
        title: "Enhanced KM Analysis Complete",
        description: `RAW KM times calculated for ${horsesWithValidTimes} of ${horsesWithRawKmTimes.length} horses with enhanced distance, race type, and time-of-day adjustments.`,
      });
      
    } catch (err) {
      console.error("Error during enhanced KM analysis:", err);
      setError(`Enhanced KM analysis failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      toast({
        title: "Enhanced KM Analysis Error",
        description: "Failed to complete enhanced modern KM normalization analysis. Check console for details.",
        variant: "destructive",
      });
    } finally {
      setTimeout(() => setLoading(false), 1000);
    }
  };

  return {
    loading,
    progress,
    currentTask,
    error,
    enhancedHorses,
    modernResults,
    raceInfo,
    analyzeRace,
    applyModernNormalizationToHorses
  };
};
