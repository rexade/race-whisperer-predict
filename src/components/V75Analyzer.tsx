
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Trophy, CalendarIcon, Settings2, Trash2, Play, Download } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import V75DatePicker from "./v75/V75DatePicker";
import { PostPositionCurves, getDefaultPostPositionCurves } from "./PostPositionCurveEditor";
import ErrorDisplay from "./modernAnalyzer/ErrorDisplay";
import DebugErrorBoundary from "./DebugErrorBoundary";
import ThemeToggle from "./ThemeToggle";
import { useV75Analysis } from "./v75/hooks/useV75Analysis";
import { NormalizationWeights, getDefaultWeights } from '../services/modernKm/index';
import { exportV75ToExcel } from '../utils/excelExport';
import { useGameInfo, useRaceData } from '@/queries/v75';
import { GAME_TYPE } from '@/config/game';

// Shared components
import AnalyzerLayout from "./shared/analyzer/AnalyzerLayout";
import AnalyzerCard from "./shared/analyzer/AnalyzerCard";
import ProgressStrip from "./shared/ProgressStrip";

// V75-specific components
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

  // React Query Data Fetching
  const dateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
  const { data: gameInfo, isLoading: isLoadingGame, error: gameError } = useGameInfo(dateStr);
  const { data: races, isLoading: isLoadingRaces, error: raceError } = useRaceData(dateStr, gameInfo);

  const isDataReady = !!races && races.length > 0;
  const isFetching = isLoadingGame || isLoadingRaces;

  const {
    loading: isAnalyzing,
    progress,
    currentTask,
    error,
    v75Results,
    analysisDate,
    runAnalysis,
    reanalyzeWithNewWeights,
    clearError
  } = useV75Analysis();

  const handleAnalyzeV75 = () => {
    if (!selectedDate || !races || !gameInfo) return;
    clearError(); // Clear any previous errors
    setShowInput(false);
    // Use the fetched data for analysis
    runAnalysis(races, dateStr!, gameInfo.gameId, weights, postPositionCurves);
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
      // Guard: Don't trigger if user is typing in an input
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      // 1-8 to jump between races if results present
      if (v75Results.length > 0) {
        const n = Number(e.key);
        if (n >= 1 && n <= Math.min(8, v75Results.length)) {
          setActiveTab(`race-${n}`);
        }
      }
      // A to analyze
      if (e.key.toLowerCase() === "a" && !isAnalyzing && selectedDate && isDataReady) {
        handleAnalyzeV75();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [v75Results, isAnalyzing, selectedDate, isDataReady, races, gameInfo]);

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
                disabled={!selectedDate || isAnalyzing || !isDataReady}
                className="flex-shrink-0 h-8 sm:h-9"
              >
                <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline text-sm">
                  {isAnalyzing ? "Analyzing…" : isFetching ? "Loading Data..." : "Analyze"}
                </span>
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
      {isAnalyzing && (
        <div className="border-b border-border/50 bg-muted/30">
          <div className="container mx-auto px-4 sm:px-6 py-2">
            <ProgressStrip progress={progress} label={currentTask || "Analyzing…"} />
          </div>
        </div>
      )}

      <AnalyzerLayout>
        {/* Welcome card - only show when no results and no error */}
        {showInput && !error && v75Results.length === 0 && (
          <AnalyzerCard
            title={`${GAME_TYPE} Multi-Race Analyzer`}
            description={`Analyze all races in a ${GAME_TYPE} day with advanced RAW time normalization and intelligent caching. Select a date in the toolbar above to get started.`}
            icon={<Trophy className="h-6 w-6" />}
          />
        )}

        {/* React Query error display */}
        {(gameError || raceError) && (
          <AnalyzerCard>
            <div className="space-y-3">
              <ErrorDisplay
                error={gameError ? `Failed to fetch game info: ${gameError.message}` : `Failed to fetch race data: ${raceError?.message}`}
              />
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedDate(undefined);
                    setTimeout(() => setShowInput(true), 100);
                  }}
                >
                  Try another date
                </Button>
              </div>
            </div>
          </AnalyzerCard>
        )}

        {/* Error display */}
        {error && (
          <AnalyzerCard>
            <div className="space-y-3">
              <ErrorDisplay error={error} />
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    clearError();
                    setShowInput(true);
                  }}
                >
                  Try Again
                </Button>
              </div>
            </div>
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
              analysisDate={analysisDate}
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
