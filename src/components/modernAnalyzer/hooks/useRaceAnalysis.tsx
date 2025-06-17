
import { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { fetchEnhancedRaceData, EnhancedHorseData } from '../../../services/enhancedAtgApi';
import { calculateRawTimesForRaceWithId } from '../../../services/timeProcessor';
import { validateRaceData, fixRaceDataIssues } from '../../../services/raceDataValidator';
import { 
  applyModernNormalization, 
  ModernNormalizedResult, 
  NormalizationWeights,
  ModernNormalizationFactors
} from '../../../services/modernNormalization';

export const useRaceAnalysis = () => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTask, setCurrentTask] = useState("");
  const [error, setError] = useState("");
  const [enhancedHorses, setEnhancedHorses] = useState<EnhancedHorseData[]>([]);
  const [modernResults, setModernResults] = useState<ModernNormalizedResult[]>([]);
  const [raceInfo, setRaceInfo] = useState<any>(null);
  const { toast } = useToast();

  const applyModernNormalizationToHorses = (horses: EnhancedHorseData[], raceData: any, weights: NormalizationWeights) => {
    const results: ModernNormalizedResult[] = [];
    
    for (const horse of horses) {
      if (!horse.rawTime) continue;
      
      const factors: ModernNormalizationFactors = {
        postPosition: horse.postPosition,
        distance: horse.distance,
        startMethod: horse.startMethod,
        shoesFront: horse.shoes.front,
        shoesBack: horse.shoes.back,
        sulkyType: horse.sulky.type,
        homeTrack: horse.homeTrack,
        driverExperience: horse.driver.experience,
        driverWinPercentage: horse.driver.winPercentage,
        driverWinPercentage2025: horse.driver.winPercentage2025,
        horseForm: horse.statistics.winPercentage
      };
      
      const result = applyModernNormalization(horse.rawTime, factors, weights);
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
      
      // Fetch enhanced race data with validation - ALL DATA FROM MAIN RACE ENDPOINT
      let raceData = await fetchEnhancedRaceData(raceId);
      
      // Validate and fix data quality issues
      const validation = validateRaceData(raceData);
      
      if (!validation.isValid) {
        console.warn('Race data has quality issues, attempting to fix...');
        
        toast({
          title: "Data Quality Issues Detected",
          description: `Found ${validation.errors.length} errors. Attempting automatic fixes...`,
          variant: "destructive",
        });
        
        // Attempt to fix the issues
        raceData = fixRaceDataIssues(raceData);
        
        // Validate again
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
      
      setCurrentTask("Calculating RAW times with historical data...");
      setProgress(50);
      
      // Create proper mapping using POST POSITIONS (not start numbers)
      const atgStarts = raceData.horses.map(horse => ({
        horse: { id: horse.horseId, name: horse.name },
        number: horse.postPosition, // This is for compatibility but we use postPosition for historical fetch
        postPosition: horse.postPosition, // THIS IS WHAT WE USE FOR HISTORICAL DATA FETCH
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
      
      // Use the enhanced function with POST POSITION mapping for historical data
      const rawTimes = await calculateRawTimesForRaceWithId(raceId, atgStarts, (current, total) => {
        const progressValue = 50 + (current / total) * 30;
        setProgress(progressValue);
        setCurrentTask(`Fetching historical data for RAW time calculation: horse ${current} of ${total}...`);
      });
      
      // Add RAW times to enhanced horse data
      const horsesWithRawTimes = raceData.horses.map(horse => {
        const rawTimeData = rawTimes.find(rt => rt.horseId === horse.horseId);
        return {
          ...horse,
          rawTime: rawTimeData?.best3Average || 0
        };
      });
      
      setEnhancedHorses(horsesWithRawTimes);
      
      setCurrentTask("Applying modern normalization...");
      setProgress(80);
      
      // Apply modern normalization to each horse
      applyModernNormalizationToHorses(horsesWithRawTimes, raceData, weights);
      
      setProgress(100);
      setCurrentTask("Analysis complete!");
      
      const horsesWithValidTimes = horsesWithRawTimes.filter(h => h.rawTime && h.rawTime > 0).length;
      
      toast({
        title: "Analysis Complete",
        description: `RAW times calculated for ${horsesWithValidTimes} of ${horsesWithRawTimes.length} horses using historical data (now discarded).`,
      });
      
    } catch (err) {
      console.error("Error during analysis:", err);
      setError(`Analysis failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      toast({
        title: "Analysis Error",
        description: "Failed to complete modern normalization analysis. Check console for details.",
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
