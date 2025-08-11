
import React, { useState, useEffect } from 'react';
import { Trophy } from "lucide-react";
import { format } from "date-fns";
import WeightManager from "./WeightManager";
import ProgressIndicator from "./modernAnalyzer/ProgressIndicator";
import ErrorDisplay from "./modernAnalyzer/ErrorDisplay";
import DebugErrorBoundary from "./DebugErrorBoundary";
import { useV75Analysis } from "./v75/hooks/useV75Analysis";
import { useRockSolidDebugger } from "./v75/hooks/useRockSolidDebugger";
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
  const [activeTab, setActiveTab] = useState("");
  const [showCacheManager, setShowCacheManager] = useState(false);
  const [showInput, setShowInput] = useState(true);
  
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
  
  const { isAutoDebugging, exportRockSolidReport } = useRockSolidDebugger();

  const handleAnalyzeV75 = () => {
    if (!selectedDate) return;
    setShowInput(false);
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
      setActiveTab(`race-${v75Results[0].raceNumber}`);
    }
  }, [v75Results]);

  // Collapse input when results are available
  useEffect(() => {
    if (v75Results.length > 0) {
      setShowInput(false);
    } else {
      setShowInput(true);
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
          {/* Date Selection / Summary */}
          {showInput ? (
            <V75Input
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
              onAnalyze={handleAnalyzeV75}
              loading={loading}
            />
          ) : (
            v75Results.length > 0 && (
              <div className="flex items-center justify-between gap-3 px-2 sm:px-0">
                <div className="text-xs sm:text-sm text-muted-foreground">
                  {analysisDate ? format(new Date(analysisDate), 'PPP') : (selectedDate ? format(selectedDate, 'PPP') : '')} • {v75Results.length} races
                </div>
                <button
                  onClick={() => setShowInput(true)}
                  className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 underline touch-manipulation"
                >
                  Change date
                </button>
              </div>
            )
          )}

          {/* Tools (collapsed) */}
          <div className="mt-2">
            <div className="sm:hidden h-px bg-border my-1" />
            <div className="flex items-center justify-between">
              <details className="w-full">
                <summary className="cursor-pointer text-xs sm:text-sm text-muted-foreground">Tools</summary>
                <div className="mt-2 flex justify-end gap-4">
                  <button
                    onClick={() => setShowCacheManager(!showCacheManager)}
                    className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 underline touch-manipulation py-2"
                  >
                    {showCacheManager ? 'Hide' : 'Show'} Cache Manager
                  </button>
                  {isAutoDebugging && (
                    <button
                      onClick={exportRockSolidReport}
                      className="text-xs sm:text-sm text-green-600 hover:text-green-800 underline touch-manipulation py-2"
                    >
                      Export Debug Report
                    </button>
                  )}
                </div>
              </details>
            </div>
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
