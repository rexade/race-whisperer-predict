
import { useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { V75PostRaceAnalysis } from '../types/postRaceAnalysisTypes';
import { V75ResultsFetcher } from '../services/v75ResultsFetcher';
import { V75PredictionComparator } from '../services/v75PredictionComparator';
import { validateDateFormat, checkDateNotInFuture } from '../utils/postRaceUtils';

export const useV75PostRaceAnalysis = () => {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<V75PostRaceAnalysis | null>(null);
  const [error, setError] = useState<string>("");
  const { toast } = useToast();

  const analyzePostRace = async (date: string) => {
    setLoading(true);
    setError("");
    
    try {
      console.log(`🎯 Starting post-race analysis for V75 ${date}`);
      
      // Step 1: Validate date format and check if not in future
      validateDateFormat(date);
      checkDateNotInFuture(date);
      
      // Step 2: Fetch actual race results
      console.log(`📊 Fetching actual results for ${date}...`);
      const actualResults = await V75ResultsFetcher.fetchActualResults(date);
      
      if (actualResults.length === 0) {
        throw new Error('No completed V75 races found for this date. The races may not have finished yet or no V75 was held.');
      }
      
      console.log(`✅ Found ${actualResults.length} completed races`);
      
      // Step 3: Compare with predictions
      console.log(`🔍 Comparing with cached predictions...`);
      const postRaceAnalysis = await V75PredictionComparator.compareWithPredictions(date, actualResults);
      
      setAnalysis(postRaceAnalysis);
      
      const accuracyPercentage = Math.round(postRaceAnalysis.overallPerformance.averageAccuracy * 100);
      
      toast({
        title: "Post-Race Analysis Complete",
        description: `Analyzed ${postRaceAnalysis.races.length} races with ${accuracyPercentage}% average accuracy.`,
      });
      
      console.log(`✅ Post-race analysis complete:`, {
        racesAnalyzed: postRaceAnalysis.races.length,
        averageAccuracy: `${accuracyPercentage}%`,
        bestRace: `${Math.round(postRaceAnalysis.overallPerformance.bestRaceAccuracy * 100)}%`,
        worstRace: `${Math.round(postRaceAnalysis.overallPerformance.worstRaceAccuracy * 100)}%`
      });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      
      toast({
        title: "Post-Race Analysis Failed",
        description: errorMessage,
        variant: "destructive",
      });
      
      console.error('❌ Post-race analysis error:', err);
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
