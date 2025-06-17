
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import WeightManager from "./WeightManager";
import ModernNormalizationTable from "./ModernNormalizationTable";
import AnalyzerHeader from "./modernAnalyzer/AnalyzerHeader";
import RaceInput from "./modernAnalyzer/RaceInput";
import ProgressIndicator from "./modernAnalyzer/ProgressIndicator";
import ErrorDisplay from "./modernAnalyzer/ErrorDisplay";
import RaceInfoDisplay from "./modernAnalyzer/RaceInfoDisplay";
import { useRaceAnalysis } from "./modernAnalyzer/hooks/useRaceAnalysis";
import { NormalizationWeights, getDefaultWeights } from '../services/modernNormalization';

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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      <div className="max-w-7xl mx-auto space-y-6 p-6">
        <Card className="border-purple-200 shadow-lg">
          <AnalyzerHeader />
          
          <CardContent className="space-y-6">
            <RaceInput 
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
              <RaceInfoDisplay raceInfo={raceInfo} horseCount={enhancedHorses.length} />
            )}
          </CardContent>
        </Card>

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
      </div>
    </div>
  );
};

export default ModernNormalizationAnalyzer;
