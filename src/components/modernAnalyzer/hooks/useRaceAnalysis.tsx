
import { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { fetchEnhancedRaceData, EnhancedHorseData } from '../../services/enhancedAtgApi';
import { calculateRawTimesForRace } from '../../services/timeProcessor';
import { 
  applyModernNormalization, 
  ModernNormalizedResult, 
  NormalizationWeights,
  ModernNormalizationFactors
} from '../../services/modernNormalization';

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
      
      // Fetch enhanced race data
      const raceData = await fetchEnhancedRaceData(raceId);
      setRaceInfo(raceData);
      
      setCurrentTask("Calculating RAW times...");
      setProgress(50);
      
      // Calculate RAW times for all horses
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
      
      const rawTimes = await calculateRawTimesForRace(atgStarts, (current, total) => {
        const progressValue = 50 + (current / total) * 30;
        setProgress(progressValue);
        setCurrentTask(`Calculating RAW time for horse ${current} of ${total}...`);
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
      
      toast({
        title: "Analysis Complete",
        description: `Modern normalization applied to ${horsesWithRawTimes.length} horses.`,
      });
      
    } catch (err) {
      console.error("Error during analysis:", err);
      setError(`Analysis failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      toast({
        title: "Analysis Error",
        description: "Failed to complete modern normalization analysis.",
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
