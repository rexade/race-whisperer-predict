
import React, { useState, useEffect } from 'react';
import { Sparkles } from "lucide-react";
import WeightManager from "./WeightManager";
import ModernNormalizationTable from "./ModernNormalizationTable";
import ProgressIndicator from "./modernAnalyzer/ProgressIndicator";
import ErrorDisplay from "./modernAnalyzer/ErrorDisplay";
import { useRaceAnalysis } from "./modernAnalyzer/hooks/useRaceAnalysis";
import { NormalizationWeights, getDefaultWeights } from '../services/modernKm/index';

// Shared components
import AnalyzerLayout from "./shared/analyzer/AnalyzerLayout";
import AnalyzerCard from "./shared/analyzer/AnalyzerCard";

// Modern-specific components
import ModernInput from "./modern/components/ModernInput";
import ModernSummary from "./modern/components/ModernSummary";

const ModernNormalizationAnalyzer: React.FC = () => {
  const [raceId, setRaceId] = useState("2025-01-15_19_7");
  const [weights, setWeights] = useState<NormalizationWeights>(getDefaultWeights());
  
  const {
    loading,
    progress,
    currentTask,
    error,
    enhancedHorses,
    modernResults,
    raceInfo,
    analyzeRace,
    applyModernNormalizationToHorses
  } = useRaceAnalysis();

  const handleAnalyzeRace = () => {
    analyzeRace(raceId, weights);
  };

  // Recalculate when weights change
  useEffect(() => {
    if (enhancedHorses.length > 0 && raceInfo) {
      applyModernNormalizationToHorses(enhancedHorses, raceInfo, weights);
    }
  }, [weights, enhancedHorses, raceInfo, applyModernNormalizationToHorses]);

  return (
    <AnalyzerLayout>
      <AnalyzerCard
        title="Modern Normalization Analyzer"
        description="Advanced RAW time normalization using race-specific factors and adjustable weights"
        icon={<Sparkles className="h-6 w-6" />}
      >
        <ModernInput 
          raceId={raceId}
          setRaceId={setRaceId}
          onAnalyze={handleAnalyzeRace}
          loading={loading}
        />

        {loading && (
          <ProgressIndicator progress={progress} currentTask={currentTask} />
        )}

        {error && (
          <ErrorDisplay error={error} />
        )}

        {raceInfo && enhancedHorses.length > 0 && (
          <ModernSummary raceInfo={raceInfo} horseCount={enhancedHorses.length} />
        )}
      </AnalyzerCard>

      {enhancedHorses.length > 0 && (
        <>
          <WeightManager weights={weights} onWeightsChange={setWeights} />
          
          {modernResults.length > 0 && (
            <ModernNormalizationTable 
              horses={enhancedHorses}
              results={modernResults}
              raceInfo={raceInfo}
            />
          )}
        </>
      )}
    </AnalyzerLayout>
  );
};

export default ModernNormalizationAnalyzer;
