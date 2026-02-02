
import { useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { V75PostRaceAnalysis } from '../types/postRaceAnalysisTypes';
import { V75ResultsFetcher } from '../services/v75ResultsFetcher';
import { V75PredictionComparator } from '../services/v75PredictionComparator';
import { validateDateFormat, checkDateNotInFuture } from '../utils/postRaceUtils';
import { V75CacheService } from '../../../services/v75CacheService';
import { V75DataConsistencyValidator } from '../../../services/v75DataConsistencyValidator';
import { fetchV75GameInfo } from '@/services/v75CalendarApi';
import { fetchKmtidDataForDate, mergeKmtidIntoResults } from '@/services/kmtid';

export const useV75PostRaceAnalysis = () => {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<V75PostRaceAnalysis | null>(null);
  const [error, setError] = useState<string>("");
  const { toast } = useToast();

  const analyzePostRace = async (date: string) => {
    setLoading(true);
    setError("");
    
    try {
      
      // Step 1: Validate date format and check if not in future
      validateDateFormat(date);
      checkDateNotInFuture(date);
      
      // Step 2: Run data consistency validation
      const consistencyReports = await V75DataConsistencyValidator.validateConsistency(date);
      
      // Step 3: Check if predictions exist for this date
      const hasPredictions = await V75CacheService.hasPredictionsForDate(date);
      
      if (!hasPredictions) {
        const errorMsg = `No V75 predictions found for ${date}. You must first analyze this date using the V75 Analyzer to create predictions, then return here to compare them with actual results.`;
        throw new Error(errorMsg);
      }
      
      // Step 4: Fetch game info once, then results (avoids duplicate calendar/day)
      const gameInfo = await fetchV75GameInfo(date);
      let actualResults = await V75ResultsFetcher.fetchActualResults(date, gameInfo ?? undefined);
      
      if (actualResults.length === 0) {
        throw new Error('No completed V75 races found for this date. The races may not have finished yet or no V75 was held.');
      }

      // Step 4b: Optionally merge kmtid.atgx.se analytics (first/last 200m, slipstream, graph)
      const kmtidMap = await fetchKmtidDataForDate(date);
      actualResults = mergeKmtidIntoResults(actualResults, kmtidMap);
      
      // Step 5: Compare with predictions (STRICT MODE - no fallback regeneration)
      const postRaceAnalysis = await V75PredictionComparator.compareWithPredictions(date, actualResults);
      
      setAnalysis(postRaceAnalysis);
      
      const accuracyPercentage = Math.round(postRaceAnalysis.overallPerformance.averageAccuracy * 100);
      const timeMAEDisplay = postRaceAnalysis.overallPerformance.overallTimeMAE 
        ? `${postRaceAnalysis.overallPerformance.overallTimeMAE.toFixed(2)}s` 
        : 'N/A';
      
      toast({
        title: "Post-Race Analysis Complete",
        description: `Analyzed ${postRaceAnalysis.races.length} races with ${accuracyPercentage}% accuracy. Time MAE: ${timeMAEDisplay}`,
      });
      
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      
      
      toast({
        title: "Post-Race Analysis Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const clearAnalysis = () => {
    setAnalysis(null);
    setError("");
  };

  return {
    loading,
    analysis,
    error,
    analyzePostRace,
    clearAnalysis
  };
};
