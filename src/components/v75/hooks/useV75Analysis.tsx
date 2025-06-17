
import { useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { fetchV75RaceData, V75RaceData } from '../../../services/v75CalendarApi';
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
  horseName: string;
  postPosition: number;
  rawKmTime?: KmTime;
  modernNormalizedResult?: ModernKmNormalizedResult;
  driverName: string;
  track: string;
  distance: number;
  startMethod: string;
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

  const analyzeV75Date = async (date: string, weights: NormalizationWeights) => {
    setLoading(true);
    setError("");
    setProgress(0);
    setAnalysisDate(date);
    
    try {
      setCurrentTask("Checking for V75 races...");
      setProgress(5);
      
      console.log(`🔍 Checking for V75 races on ${date}...`);
      
      const v75Races = await fetchV75RaceData(date);
      
      if (v75Races.length === 0) {
        setError(`No V75 races found for ${date}. Please select a different date with V75 races.`);
        toast({
          title: "No V75 Races Found",
          description: `No V75 races were found for ${date}. Try selecting a different date.`,
          variant: "destructive",
        });
        return;
      }
      
      console.log(`✅ Found ${v75Races.length} V75 races for ${date}`);
      
      setCurrentTask(`Found ${v75Races.length} V75 races. Starting analysis...`);
      setProgress(10);
      
      const results: V75RaceResult[] = [];
      
      for (let i = 0; i < v75Races.length; i++) {
        const race = v75Races[i];
        const raceProgress = (i / v75Races.length) * 80;
        
        setCurrentTask(`Analyzing race ${race.raceNumber} of ${v75Races.length}...`);
        setProgress(10 + raceProgress);
        
        try {
          // Convert horses to ATG starts format for KM time calculation
          const atgStarts = race.horses.map(horse => ({
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
          
          console.log(`\n=== 🔥 V75 Race ${race.raceNumber} Analysis ===`);
          console.log(`Race ID: ${race.raceId}`);
          console.log(`Track: ${race.track}, Distance: ${race.distance}m`);
          
          // Calculate RAW KM times
          setCurrentTask(`Calculating RAW KM times for race ${race.raceNumber}...`);
          const rawKmTimes = await calculateRawKmTimesForRaceWithId(
            race.raceId, 
            atgStarts, 
            (current, total) => {
              const horseProgress = (current / total) * (80 / v75Races.length);
              setProgress(10 + raceProgress + horseProgress);
              setCurrentTask(`Race ${race.raceNumber}: Fetching historical data for horse ${current} of ${total}...`);
            }
          );
          
          // Apply modern normalization
          const horseResults: V75HorseResult[] = [];
          
          for (const horse of race.horses) {
            const rawTimeData = rawKmTimes.find(rt => rt.horseId === horse.horseId);
            const rawKmTime = rawTimeData?.best3Average;
            
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
              horseName: horse.name,
              postPosition: horse.postPosition,
              rawKmTime,
              modernNormalizedResult,
              driverName: `${horse.driver.firstName} ${horse.driver.lastName}`,
              track: race.track,
              distance: horse.distance,
              startMethod: race.startMethod
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
          
        } catch (raceError) {
          console.error(`Error analyzing race ${race.raceNumber}:`, raceError);
          
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
      
      toast({
        title: "V75 Analysis Complete",
        description: `Successfully analyzed ${successfulRaces} of ${v75Races.length} races for ${date}`,
      });
      
    } catch (err) {
      console.error("Error during V75 analysis:", err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      
      if (errorMessage.includes('Failed to fetch V75 race data')) {
        setError(`No V75 races found for ${date}. This date may not have V75 races or the data may not be available yet.`);
      } else {
        setError(`V75 analysis failed: ${errorMessage}`);
      }
      
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
    
    console.log('Re-applying modern normalization with updated weights...');
    
    const updatedResults = v75Results.map(race => {
      if (!race.analysisComplete || race.horses.length === 0) return race;
      
      const updatedHorses = race.horses.map(horse => {
        if (!horse.rawKmTime) return horse;
        
        const factors: ModernNormalizationFactors = {
          postPosition: horse.postPosition,
          distance: horse.distance,
          raceDistance: race.distance,
          startMethod: race.startMethod,
          shoesFront: "0",
          shoesBack: "0",
          sulkyType: "VA",
          homeTrack: "Unknown",
          driverExperience: 0,
          driverWinPercentage: 0,
          driverWinPercentage2025: 0,
          horseForm: 0,
          raceType: 'trot',
          timeOfDay: '',
          startPoints: 500,
          placePercentage: 5000,
          horseWinPercentage: 1500,
          earningsPerStart: 300000
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
