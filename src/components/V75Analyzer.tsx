
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Trophy, CalendarIcon, Settings2, Trash2, Play, Download } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import V75DatePicker from "./v75/V75DatePicker";
import { PostPositionCurves, getDefaultPostPositionCurves } from "./PostPositionCurveEditor";
import ProgressIndicator from "./modernAnalyzer/ProgressIndicator";
import ErrorDisplay from "./modernAnalyzer/ErrorDisplay";
import DebugErrorBoundary from "./DebugErrorBoundary";
import ThemeToggle from "./ThemeToggle";
import { useV75Analysis } from "./v75/hooks/useV75Analysis";
import { useRockSolidDebugger } from "./v75/hooks/useRockSolidDebugger";
import { NormalizationWeights, getDefaultWeights } from '../services/modernKm/index';
import { exportV75ToExcel } from '../utils/excelExport';

// Shared components
import AnalyzerLayout from "./shared/analyzer/AnalyzerLayout";
import AnalyzerCard from "./shared/analyzer/AnalyzerCard";
import ProgressStrip from "./shared/ProgressStrip";

// V75-specific components
import V75Input from "./v75/components/V75Input";
import V75Summary from "./v75/components/V75Summary";

// Lazy load heavy components for better performance
const V75Results = lazy(() => import("./v75/components/V75Results"));
const V75CacheManager = lazy(() => import("./v75/components/V75CacheManager"));
const WeightManager = lazy(() => import("./WeightManager"));

const V75Analyzer: React.FC = () => {
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
    v75Results,
    analysisDate,
    analyzeV75Date,
    reanalyzeWithNewWeights,
    clearError
  } = useV75Analysis();
  
  const { isAutoDebugging, exportRockSolidReport, startFresh } = useRockSolidDebugger();

  const handleAnalyzeV75 = () => {
    if (!selectedDate) return;
    clearError(); // Clear any previous errors
    setShowInput(false);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    analyzeV75Date(dateStr, weights, postPositionCurves);
  };

  // Recalculate when weights or post position curves change
  useEffect(() => {
    if (v75Results.length > 0) {
      reanalyzeWithNewWeights(weights, postPositionCurves);
    }
  }, [weights, postPositionCurves]);

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

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 1-8 to jump between races if results present
      if (v75Results.length > 0) {
        const n = Number(e.key);
        if (n >= 1 && n <= Math.min(8, v75Results.length)) {
          setActiveTab(`race-${n}`);
        }
      }
      // A to analyze
      if (e.key.toLowerCase() === "a" && !loading && selectedDate) {
        handleAnalyzeV75();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [v75Results, loading, selectedDate]);

  return (
    <DebugErrorBoundary>
      {/* Clean minimal toolbar */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border/50">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14 gap-2 sm:gap-4">
            {/* Left: Minimal branding */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Trophy className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium text-foreground hidden sm:inline">TrotAnalyzer</span>
            </div>

            {/* Center: Main actions */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-1 justify-center max-w-2xl min-w-0">
              <div className="flex-shrink-0">
                <V75DatePicker
                  selectedDate={selectedDate}
                  onDateSelect={setSelectedDate}
                />
              </div>
              <Button 
                size="sm" 
                onClick={handleAnalyzeV75} 
                disabled={!selectedDate || loading}
                className="flex-shrink-0 h-8 sm:h-9"
              >
                <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline text-sm">{loading ? "Analyzing…" : "Analyze"}</span>
                <span className="sm:hidden text-xs">Go</span>
              </Button>
              {v75Results.length > 0 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => exportV75ToExcel(v75Results, analysisDate)}
                  title="Export to Excel"
                  className="flex-shrink-0 h-8 sm:h-9"
                >
                  <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
              )}
            </div>

            {/* Right: Settings & Theme */}
            <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setShowWeights((v) => !v)} 
                title="Weights"
                className="h-8 w-8 sm:h-9 sm:w-9"
              >
                <Settings2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setShowCacheManager((v) => !v)} 
                title="Cache"
                className="h-8 w-8 sm:h-9 sm:w-9"
              >
                <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>

      {/* Progress strip */}
      {loading && (
        <div className="border-b border-border/50 bg-muted/30">
          <div className="container mx-auto px-4 sm:px-6 py-2">
            <ProgressStrip progress={progress} label={currentTask || "Analyzing…"} />
          </div>
        </div>
      )}

      <AnalyzerLayout>
        {/* Header - only show full card when no results or showing input */}
        {(showInput || error) && (
          <AnalyzerCard
            title={showInput ? "V85 Multi-Race Analyzer" : undefined}
            description={showInput ? "Analyze all 8 races in a V85 day with advanced RAW time normalization and intelligent caching" : undefined}
            icon={showInput ? <Trophy className="h-6 w-6" /> : undefined}
          >
            {/* Date Selection */}
            {showInput ? (
              <V75Input
                selectedDate={selectedDate}
                onDateSelect={setSelectedDate}
                onAnalyze={handleAnalyzeV75}
                loading={loading}
              />
            ) : null}

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
          </AnalyzerCard>
        )}

        {/* Results Summary - show as compact card when results exist */}
        {v75Results.length > 0 && !showInput && (
          <V75Summary races={v75Results} analysisDate={analysisDate} />
        )}

        {/* Cache Manager */}
        {showCacheManager && (
          <DebugErrorBoundary>
            <Suspense fallback={<div className="p-4 text-center text-muted-foreground">Loading cache manager...</div>}>
              <V75CacheManager />
            </Suspense>
          </DebugErrorBoundary>
        )}

        {/* Weight Manager */}
        {v75Results.length > 0 && showWeights && (
          <DebugErrorBoundary>
            <Suspense fallback={<div className="p-4 text-center text-muted-foreground">Loading weights...</div>}>
              <WeightManager 
                weights={weights} 
                onWeightsChange={setWeights}
                postPositionCurves={postPositionCurves}
                onPostPositionCurvesChange={setPostPositionCurves}
              />
            </Suspense>
          </DebugErrorBoundary>
        )}

        {/* Results */}
        {v75Results.length > 0 && (
          <Suspense fallback={<div className="p-4 text-center text-muted-foreground">Loading results...</div>}>
            <V75Results
              races={v75Results}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          </Suspense>
        )}
      </AnalyzerLayout>
    </DebugErrorBoundary>
  );
};

export default V75Analyzer;
