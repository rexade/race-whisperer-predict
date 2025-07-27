
import React, { useState, useEffect } from 'react';
import { Trophy } from "lucide-react";
import { format } from "date-fns";
import WeightManager from "./WeightManager";
import ProgressIndicator from "./modernAnalyzer/ProgressIndicator";
import ErrorDisplay from "./modernAnalyzer/ErrorDisplay";
import DebugErrorBoundary from "./DebugErrorBoundary";
import { useV75Analysis } from "./v75/hooks/useV75Analysis";
import { NormalizationWeights, getDefaultWeights } from '../services/modernKm/index';

// Shared components
import AnalyzerLayout from "./shared/analyzer/AnalyzerLayout";
import AnalyzerCard from "./shared/analyzer/AnalyzerCard";

// V75-specific components
import V75Input from "./v75/components/V75Input";
import V75Summary from "./v75/components/V75Summary";
import V75Results from "./v75/components/V75Results";
import V75CacheManager from "./v75/components/V75CacheManager";

const V75Analyzer: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [weights, setWeights] = useState<NormalizationWeights>(getDefaultWeights());
  const [activeTab, setActiveTab] = useState("overview");
  const [showCacheManager, setShowCacheManager] = useState(false);
  
  const {
    loading,
    progress,
    currentTask,
    error,
    v75Results,
    analysisDate,
    analyzeV75Date,
    reanalyzeWithNewWeights
  } = useV75Analysis();

  const handleAnalyzeV75 = () => {
    if (!selectedDate) return;
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    analyzeV75Date(dateStr, weights);
  };

  // Recalculate when weights change
  useEffect(() => {
    if (v75Results.length > 0) {
      reanalyzeWithNewWeights(weights);
    }
  }, [weights]);

  // Update active tab when results are loaded
  useEffect(() => {
    if (v75Results.length > 0) {
      setActiveTab("overview");
    }
  }, [v75Results]);

  return (
    <DebugErrorBoundary>
      <AnalyzerLayout>
        {/* Header */}
        <AnalyzerCard
          title="V75 Multi-Race Analyzer"
          description="Analyze all 7 races in a V75 day with advanced RAW time normalization and intelligent caching"
          icon={<Trophy className="h-6 w-6" />}
        >
          {/* Date Selection and Analysis */}
          <V75Input
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
            onAnalyze={handleAnalyzeV75}
            loading={loading}
          />

          {/* Cache Manager Toggle - Mobile friendly */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowCacheManager(!showCacheManager)}
              className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 underline touch-manipulation py-2"
            >
              {showCacheManager ? 'Hide' : 'Show'} Cache Manager
            </button>
          </div>

          {/* Progress */}
          {loading && (
            <ProgressIndicator progress={progress} currentTask={currentTask} />
          )}

          {/* Error */}
          {error && (
            <ErrorDisplay error={error} />
          )}

          {/* Results Summary */}
          {v75Results.length > 0 && (
            <V75Summary races={v75Results} analysisDate={analysisDate} />
          )}
        </AnalyzerCard>

        {/* Cache Manager */}
        {showCacheManager && (
          <DebugErrorBoundary>
            <V75CacheManager />
          </DebugErrorBoundary>
        )}

        {/* Weight Manager */}
        {v75Results.length > 0 && (
          <DebugErrorBoundary>
            <WeightManager weights={weights} onWeightsChange={setWeights} />
          </DebugErrorBoundary>
        )}

        {/* Results */}
        {v75Results.length > 0 && (
          <V75Results
            races={v75Results}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        )}
      </AnalyzerLayout>
    </DebugErrorBoundary>
  );
};

export default V75Analyzer;
