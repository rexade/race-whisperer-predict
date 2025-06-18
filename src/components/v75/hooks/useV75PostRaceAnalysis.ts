
import { useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { V75PostRaceAnalysis } from '../types/postRaceAnalysisTypes';
import { V75ResultsFetcher } from '../services/v75ResultsFetcher';
import { V75PredictionComparator } from '../services/v75PredictionComparator';
import { validateDateFormat, checkDateNotInFuture } from '../utils/postRaceUtils';
import { V75CacheService } from '../../../services/v75CacheService';
import { V75DataConsistencyValidator } from '../../../services/v75DataConsistencyValidator';

export const useV75PostRaceAnalysis = () => {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<V75PostRaceAnalysis | null>(null);
  const [error, setError] = useState<string>("");
  const { toast } = useToast();

  const analyzePostRace = async (date: string) => {
    setLoading(true);
    setError("");
    
    try {
      console.log(`🎯 Starting ENHANCED post-race analysis for V75 ${date}`);
      console.log(`📅 Analysis date: ${date}`);
      
      // Step 1: Validate date format and check if not in future
      validateDateFormat(date);
      checkDateNotInFuture(date);
      
      // Step 2: Run data consistency validation
      console.log(`🔍 Running data consistency validation...`);
      const consistencyReports = await V75DataConsistencyValidator.validateConsistency(date);
      
      if (consistencyReports.length > 0) {
        console.log(`📊 Data consistency report:`, consistencyReports);
        
        const totalIssues = consistencyReports.reduce((sum, r) => sum + r.issues.length, 0);
        const totalValidTimes = consistencyReports.reduce((sum, r) => sum + r.validPredictedTimes, 0);
        
        if (totalIssues > 0) {
          console.log(`⚠️ Found ${totalIssues} data consistency issues`);
        }
        
        console.log(`✅ Data validation complete: ${totalValidTimes} valid predicted times found`);
      }
      
      // Step 3: Check if predictions exist for this date
      console.log(`🔍 Checking for cached predictions for ${date}...`);
      const hasPredictions = await V75CacheService.hasPredictionsForDate(date);
      
      if (!hasPredictions) {
        console.log(`❌ No predictions found for ${date}`);
        
        // Additional debugging: show what dates DO have predictions
        console.log(`🗂️ Checking what dates have predictions...`);
        const cacheStatus = await V75DataConsistencyValidator.getCacheStatus();
        console.log(`📋 Available prediction dates:`, cacheStatus.availableDates);
        console.log(`📊 Cache status:`, cacheStatus);
        
        const errorMsg = `No V75 predictions found for ${date}. You must first analyze this date using the V75 Analyzer to create predictions, then return here to compare them with actual results.`;
        throw new Error(errorMsg);
      }
      
      console.log(`✅ Predictions confirmed for ${date}`);
      
      // Step 4: Fetch actual race results
      console.log(`📊 Fetching actual results for ${date}...`);
      const actualResults = await V75ResultsFetcher.fetchActualResults(date);
      
      if (actualResults.length === 0) {
        console.log(`❌ No actual results found for ${date}`);
        throw new Error('No completed V75 races found for this date. The races may not have finished yet or no V75 was held.');
      }
      
      console.log(`✅ Found ${actualResults.length} completed races with actual results`);
      actualResults.forEach((race, index) => {
        console.log(`  Race ${race.raceNumber}: ${race.finishOrder.length} finishers`);
      });
      
      // Step 5: Compare with predictions (STRICT MODE - no fallback regeneration)
      console.log(`🔍 Comparing with cached predictions (STRICT MODE)...`);
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
      
      console.log(`✅ ENHANCED post-race analysis complete:`, {
        racesAnalyzed: postRaceAnalysis.races.length,
        averageAccuracy: `${accuracyPercentage}%`,
        bestRace: `${Math.round(postRaceAnalysis.overallPerformance.bestRaceAccuracy * 100)}%`,
        worstRace: `${Math.round(postRaceAnalysis.overallPerformance.worstRaceAccuracy * 100)}%`,
        overallMAE: postRaceAnalysis.overallPerformance.overallMAE.toFixed(2),
        timeMAE: timeMAEDisplay,
        dataConsistency: 'Validated'
      });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      
      console.error('❌ Enhanced post-race analysis error:', err);
      console.error('Error details:', {
        date,
        errorMessage,
        stack: err instanceof Error ? err.stack : 'No stack trace'
      });
      
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
