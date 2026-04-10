
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Trophy, CalendarIcon, Settings2, Trash2, Play, Download, BarChart2, TrendingUp } from "lucide-react";
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
import { getAggregateMAEStats, type AggregateMAEStats } from '../services/raceMAEService';
import { useGameInfo, useRaceData, useAvailableGameTypes } from '@/queries/v75';
import { GAME_TYPE, GameType } from '@/config/game';

// Shared components
import AnalyzerLayout from "./shared/analyzer/AnalyzerLayout";
import AnalyzerCard from "./shared/analyzer/AnalyzerCard";
import ProgressStrip from "./shared/ProgressStrip";

// V75-specific components
import V75Summary from "./v75/components/V75Summary";

// Lazy load heavy components for better performance
const V75Results = lazy(() => import("./v75/components/V75Results"));
const V75CacheManager = lazy(() => import("./v75/components/V75CacheManager"));
const MAEPanel = lazy(() => import("./v75/components/MAEPanel"));
const WeightManager = lazy(() => import("./WeightManager"));
const CalibrationPanel = lazy(() => import("./calibration/CalibrationPanel"));

const V75Analyzer: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [weights, setWeights] = useState<NormalizationWeights>(() => {
    try {
      const saved = localStorage.getItem('customDefaultWeights');
      if (saved) return { ...getDefaultWeights(), ...JSON.parse(saved) };
    } catch {}
    return getDefaultWeights();
  });
  const [postPositionCurves, setPostPositionCurves] = useState<PostPositionCurves>(getDefaultPostPositionCurves());
  const [activeTab, setActiveTab] = useState("");
  const [showCacheManager, setShowCacheManager] = useState(false);
  const [showWeights, setShowWeights] = useState(false);
  const [maeStats, setMaeStats] = useState<AggregateMAEStats | null>(() => getAggregateMAEStats());
  const [showCalibration, setShowCalibration] = useState(false);
  const [showInput, setShowInput] = useState(true);
  const [gameType, setGameType] = useState<GameType>(GAME_TYPE);

  // React Query Data Fetching
  const dateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
  const { data: gameInfo, isLoading: isLoadingGame, error: gameError } = useGameInfo(dateStr, gameType);
  const { data: races, isLoading: isLoadingRaces, error: raceError } = useRaceData(dateStr, gameInfo, gameType);
  const noGameFound = !!dateStr && !isLoadingGame && !gameInfo && !gameError;
  const { data: availableGameTypes } = useAvailableGameTypes(dateStr, !noGameFound);

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

  // Auto-persist weights so they survive page refresh
  useEffect(() => {
    try {
      localStorage.setItem('customDefaultWeights', JSON.stringify(weights));
    } catch {}
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

  // Refresh MAE stats when cache drawer closes (user may have computed new MAE data)
  useEffect(() => {
    if (!showCacheManager) {
      setMaeStats(getAggregateMAEStats());
    }
  }, [showCacheManager]);

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
            {/* Left: Minimal branding + accuracy badge */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Trophy className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium text-foreground hidden sm:inline">TrotAnalyzer</span>
              {maeStats && (
                <button
                  onClick={() => setShowCacheManager(true)}
                  className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs tabular-nums text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title={`Model accuracy over ${maeStats.raceCount} race${maeStats.raceCount !== 1 ? 's' : ''}: ±${maeStats.meanRankError.toFixed(1)} mean rank error · ${(maeStats.winRate * 100).toFixed(0)}% win · ${(maeStats.top3Rate * 100).toFixed(0)}% top-3. Click to view details.`}
                >
                  <TrendingUp className="h-3 w-3" />
                  ±{maeStats.meanRankError.toFixed(1)} · {(maeStats.winRate * 100).toFixed(0)}%W
                </button>
              )}
            </div>

            {/* Center: Main actions */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-1 justify-center max-w-2xl min-w-0">
              {/* Game type selector */}
              <div className="flex-shrink-0 flex rounded-md border border-border overflow-hidden">
                {(['V75', 'V86', 'V85', 'V65'] as GameType[]).map((gt) => (
                  <button
                    key={gt}
                    onClick={() => setGameType(gt)}
                    className={`px-2 py-1 text-xs font-medium transition-colors ${
                      gameType === gt
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    {gt}
                  </button>
                ))}
              </div>
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
                title={selectedDate && !isFetching && !isDataReady ? `No ${gameType} game on this date` : undefined}
                className="flex-shrink-0 h-8 sm:h-9"
              >
                <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline text-sm">
                  {isAnalyzing ? "Analyzing…" : isFetching ? "Loading…" : "Analyze"}
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
                onClick={() => setShowCalibration((v) => !v)}
                title="Calibrate weights"
                className="h-8 w-8 sm:h-9 sm:w-9"
              >
                <BarChart2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
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

        {/* No game found for selected date */}
        {noGameFound && selectedDate && (
          <AnalyzerCard>
            <div className="text-center py-3 text-muted-foreground text-sm space-y-3">
              <p>No <strong>{gameType}</strong> game found for {format(selectedDate, "MMMM d, yyyy")}.</p>
              {availableGameTypes && availableGameTypes.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs">Available on this date:</p>
                  <div className="flex gap-2 justify-center flex-wrap">
                    {availableGameTypes.map((gt) => (
                      <Button
                        key={gt}
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => setGameType(gt as GameType)}
                      >
                        {gt}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs">No multi-race games scheduled on this date.</p>
              )}
            </div>
          </AnalyzerCard>
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

        {/* Cache Manager + MAE accuracy panel */}
        {showCacheManager && (
          <DebugErrorBoundary>
            <Suspense fallback={<div className="p-4 text-center text-muted-foreground">Loading cache manager...</div>}>
              <V75CacheManager />
            </Suspense>
          </DebugErrorBoundary>
        )}
        {showCacheManager && (
          <DebugErrorBoundary>
            <Suspense fallback={null}>
              <MAEPanel />
            </Suspense>
          </DebugErrorBoundary>
        )}

        {/* Calibration Panel — keep mounted so the loaded dataset survives Apply */}
        <div style={{ display: showCalibration ? undefined : 'none' }}>
          <DebugErrorBoundary>
            <Suspense fallback={<div className="p-4 text-center text-muted-foreground">Loading calibration…</div>}>
              <CalibrationPanel
                currentWeights={weights}
                onApplyWeights={(w) => { setWeights(w); setShowCalibration(false); }}
                postPositionCurves={postPositionCurves}
                onPostPositionCurvesChange={(c) => { setPostPositionCurves(c); }}
              />
            </Suspense>
          </DebugErrorBoundary>
        </div>

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
