
import React, { useState, useEffect } from 'react';
import { Trophy } from "lucide-react";
import { format } from "date-fns";
import WeightManager from "./WeightManager";
import { PostPositionCurves, getDefaultPostPositionCurves } from "./PostPositionCurveEditor";
import ProgressIndicator from "./modernAnalyzer/ProgressIndicator";
import ErrorDisplay from "./modernAnalyzer/ErrorDisplay";
import DebugErrorBoundary from "./DebugErrorBoundary";
import { useV85Analysis } from "./v85/hooks/useV85Analysis";
import { useRockSolidDebugger } from "./v85/hooks/useRockSolidDebugger";
import { NormalizationWeights, getDefaultWeights } from '../services/modernKm/index';

// Shared components
import AnalyzerLayout from "./shared/analyzer/AnalyzerLayout";
import AnalyzerCard from "./shared/analyzer/AnalyzerCard";

// V85-specific components
import V85Input from "./v85/components/V85Input";
import V85Summary from "./v85/components/V85Summary";
import V85Results from "./v85/components/V85Results";
import V85CacheManager from "./v85/components/V85CacheManager";

const V85Analyzer: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [weights, setWeights] = useState<NormalizationWeights>(getDefaultWeights());
  const [postPositionCurves, setPostPositionCurves] = useState<PostPositionCurves>(getDefaultPostPositionCurves());
  const [activeTab, setActiveTab] = useState("");
  const [showCacheManager, setShowCacheManager] = useState(false);
  const [showWeights, setShowWeights] = useState(false);
  const [showInput, setShowInput] = useState(true);
  
  const {
    loading,
    progress,
    currentTask,
    error,
    v85Results,
    analysisDate,
    analyzeV85Date,
    reanalyzeWithNewWeights,
    clearError
  } = useV85Analysis();
  
  const { isAutoDebugging, exportRockSolidReport, startFresh } = useRockSolidDebugger();

  const handleAnalyzeV85 = () => {
    if (!selectedDate) return;
    clearError(); // Clear any previous errors
    setShowInput(false);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    analyzeV85Date(dateStr, weights, postPositionCurves);
  };

  // Recalculate when weights or post position curves change
  useEffect(() => {
    if (v85Results.length > 0) {
      reanalyzeWithNewWeights(weights, postPositionCurves);
    }
  }, [weights, postPositionCurves]);

  // Update active tab when results are loaded
  useEffect(() => {
    if (v85Results.length > 0) {
      setActiveTab(`race-${v85Results[0].raceNumber}`);
    }
  }, [v85Results]);

  // Collapse input when results are available
  useEffect(() => {
    if (v85Results.length > 0) {
      setShowInput(false);
    } else {
      setShowInput(true);
    }
  }, [v85Results]);

  return (
    <DebugErrorBoundary>
      <AnalyzerLayout>
        {/* Header */}
        <AnalyzerCard
          title="V85 Multi-Race Analyzer"
          description="Analyze all 8 races in a V85 day with advanced RAW time normalization and intelligent caching"
          icon={<Trophy className="h-6 w-6" />}
        >
          {/* Date Selection / Summary */}
          {showInput ? (
            <V85Input
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
              onAnalyze={handleAnalyzeV85}
              loading={loading}
            />
          ) : (
            v85Results.length > 0 && (
              <div className="flex items-center justify-between gap-3 px-2 sm:px-0">
                <div className="text-xs sm:text-sm text-muted-foreground">
                  {analysisDate ? format(new Date(analysisDate), 'PPP') : (selectedDate ? format(selectedDate, 'PPP') : '')} • {v85Results.length} races
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
                  <button
                    onClick={() => setShowWeights(!showWeights)}
                    className="text-xs sm:text-sm text-purple-600 hover:text-purple-800 underline touch-manipulation py-2"
                  >
                    {showWeights ? 'Hide' : 'Show'} Weights
                  </button>
                  {isAutoDebugging && (
                    <div className="flex gap-4">
                      <button
                        onClick={exportRockSolidReport}
                        className="text-xs sm:text-sm text-green-600 hover:text-green-800 underline touch-manipulation py-2"
                      >
                        Export Debug Report
                      </button>
                      <button
                        onClick={startFresh}
                        className="text-xs sm:text-sm text-rose-600 hover:text-rose-800 underline touch-manipulation py-2"
                      >
                        Start fresh debug
                      </button>
                    </div>
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
            <div className="space-y-3">
              <ErrorDisplay error={error} />
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    clearError();
                    setShowInput(true);
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800 underline px-3 py-1"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Results Summary */}
          {v85Results.length > 0 && (
            <V85Summary races={v85Results} analysisDate={analysisDate} />
          )}
        </AnalyzerCard>

        {/* Cache Manager */}
        {showCacheManager && (
          <DebugErrorBoundary>
            <V85CacheManager />
          </DebugErrorBoundary>
        )}

        {/* Weight Manager */}
        {v85Results.length > 0 && showWeights && (
          <DebugErrorBoundary>
            <WeightManager 
              weights={weights} 
              onWeightsChange={setWeights}
              postPositionCurves={postPositionCurves}
              onPostPositionCurvesChange={setPostPositionCurves}
            />
          </DebugErrorBoundary>
        )}

        {/* Results */}
        {v85Results.length > 0 && (
          <V85Results
            races={v85Results}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        )}
      </AnalyzerLayout>
    </DebugErrorBoundary>
  );
};

export default V85Analyzer;
