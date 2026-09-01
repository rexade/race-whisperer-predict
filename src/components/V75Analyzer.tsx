
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { apiHeaders, ApiRequestError, describeApiFailure, isPersistenceApiEnabled } from '@/services/apiClient';
import { Trophy, CalendarIcon, Settings2, Play, Download, Menu } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import V75DatePicker from "./v75/V75DatePicker";
import GamePicker from "./v75/GamePicker";
import ErrorDisplay from "./modernAnalyzer/ErrorDisplay";
import DebugErrorBoundary from "./DebugErrorBoundary";
import ThemeToggle from "./ThemeToggle";
import { useV75Analysis } from "./v75/hooks/useV75Analysis";
import { NormalizationWeights, PostPositionCurves, getDefaultWeights, getDefaultPostPositionCurves, initWeightsFromApi } from '../services/modernKm/index';
import { exportV75ToExcel } from '../utils/excelExport';
import { useDayGames, useRaceData } from '@/queries/v75';
import { GAME_TYPE, GAME_TYPE_LABELS } from '@/config/game';
import type { DayGame } from '@/services/v75CalendarApi';
import { useToast } from '@/hooks/use-toast';

// Shared components
import AnalyzerLayout from "./shared/analyzer/AnalyzerLayout";
import AnalyzerCard from "./shared/analyzer/AnalyzerCard";
import ProgressStrip from "./shared/ProgressStrip";

// V75-specific components
import V75Summary from "./v75/components/V75Summary";

// Lazy load heavy components for better performance
const V75Results = lazy(() => import("./v75/components/V75Results"));
const WeightManager = lazy(() => import("./WeightManager"));

const V75Analyzer: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [weights, setWeights] = useState<NormalizationWeights>(getDefaultWeights);
  const [postPositionCurves, setPostPositionCurves] = useState<PostPositionCurves>(getDefaultPostPositionCurves());
  const [activeTab, setActiveTab] = useState("");
  const [showWeights, setShowWeights] = useState(false);
  const [showInput, setShowInput] = useState(true);
  const [selectedGame, setSelectedGame] = useState<DayGame | undefined>();
  const [menuOpen, setMenuOpen] = useState(false);
  const [chipOpen, setChipOpen] = useState(false);
  const [gamePickerOpen, setGamePickerOpen] = useState(false);
  const { toast } = useToast();
  const skipNextWeightsSaveRef = React.useRef(true);
  const lastSaveFailureRef = React.useRef<string | null>(null);

  // React Query Data Fetching -- the date drives the menu of games, and the
  // picked game carries its own race ids, so there is no second lookup left to
  // guess which of a day's eleven V4 cards was meant.
  const dateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
  const { data: dayGames, isLoading: isLoadingDay, error: dayError } = useDayGames(dateStr);
  const gameType = selectedGame?.gameType ?? GAME_TYPE;
  const { data: races, isLoading: isLoadingRaces, error: raceError } = useRaceData(dateStr, selectedGame, gameType);

  const isDataReady = !!races
    && !!selectedGame
    && races.length > 0
    && races.length === selectedGame.raceIds.length;
  const isFetching = isLoadingDay || isLoadingRaces;
  const selectionLabel = selectedGame
    ? `${GAME_TYPE_LABELS[selectedGame.gameType]} · ${selectedGame.track}`
    : 'Välj spel';

  const {
    loading: isAnalyzing,
    progress,
    currentTask,
    error,
    v75Results,
    analysisDate,
    analysisGameType,
    runAnalysis,
    reanalyzeWithNewWeights,
    clearError
  } = useV75Analysis();

  const handleAnalyzeV75 = () => {
    if (!selectedGame || !races || races.length !== selectedGame.raceIds.length) return;
    clearError(); // Clear any previous errors
    setShowInput(false);
    // Use the fetched data for analysis
    runAnalysis(races, dateStr!, selectedGame.gameId, weights, postPositionCurves, selectedGame.gameType);
  };

  // A game belongs to its date -- keeping the old selection across a date change
  // would analyze yesterday's card under today's heading.
  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setSelectedGame(undefined);
  };

  const handleGameSelect = (game: DayGame) => {
    setSelectedGame(game);
    setGamePickerOpen(false);
    setChipOpen(false);
  };

  // Recalculate when weights or post position curves change
  useEffect(() => {
    if (v75Results.length > 0) {
      reanalyzeWithNewWeights(weights, postPositionCurves);
    }
  }, [weights, postPositionCurves]);

  // Load weights from API on mount. Also restore driver empirical
  // ratings from the cached calibration dataset if localStorage lost them —
  // without ratings the driverEmpirical weight is silently inactive and saved
  // presets cannot reproduce a previous session's ranking.
  useEffect(() => {
    initWeightsFromApi().then(r => {
      skipNextWeightsSaveRef.current = true;
      setWeights(r.weights);
      if (r.postPositionCurves) setPostPositionCurves(r.postPositionCurves);
    });
  }, []);

  useEffect(() => {
    import('../services/calibration/driverRatingService')
      .then(m => m.primeDriverRatingsIfMissing(gameType))
      .catch(() => {});
  }, [gameType]);

  // Auto-persist weights to API
  useEffect(() => {
    if (!isPersistenceApiEnabled()) return;

    if (skipNextWeightsSaveRef.current) {
      skipNextWeightsSaveRef.current = false;
      return;
    }
    fetch('/api/weights', {
      method: 'PUT',
      headers: apiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ weights, postPositionCurves }),
    }).then(response => {
      if (!response.ok) throw new ApiRequestError('Save weights', response.status);
    }).catch(error => {
      const reason = error instanceof ApiRequestError
        ? describeApiFailure(error.status)
        : 'The backend could not be reached.';
      // Every weight nudge retries, so an unroutable /api would otherwise stack an
      // identical destructive toast on each keystroke. Say it once per distinct cause.
      if (lastSaveFailureRef.current === reason) return;
      lastSaveFailureRef.current = reason;
      toast({
        title: 'Weights were not saved',
        description: reason,
        variant: 'destructive',
      });
    });
  }, [weights, postPositionCurves, toast]);

  // Update active tab when results are loaded
  useEffect(() => {
    if (v75Results.length > 0) {
      setActiveTab(`race-${v75Results[0].raceId}`);
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
          setActiveTab(`race-${v75Results[n - 1].raceId}`);
        }
      }
      // A to analyze
      if (e.key.toLowerCase() === "a" && !isAnalyzing && isDataReady) {
        handleAnalyzeV75();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [v75Results, isAnalyzing, isDataReady, races, selectedGame]);

  return (
    <DebugErrorBoundary>
      {/* Racing-program masthead — collapses to brand · chip · menu on mobile */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b-2 border-foreground/70">
        <div className="container mx-auto px-3 sm:px-6">
          <div className="flex items-center justify-between h-14 gap-2 sm:gap-4">
            {/* Left: masthead brand + what is currently on screen. On a phone the
                controls sit behind the menu, so without this the header says
                nothing about which game and date the results below belong to. */}
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-display italic font-bold text-lg tracking-tight truncate">TrotAnalyzer</span>
              {v75Results.length > 0 && analysisGameType && analysisDate && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs num text-muted-foreground whitespace-nowrap">
                  {GAME_TYPE_LABELS[analysisGameType] ?? analysisGameType} · {analysisDate}
                </span>
              )}
            </div>

            {/* Desktop center: date · game · analyze · export */}
            <div className="hidden sm:flex items-center gap-2 flex-1 justify-center max-w-2xl min-w-0">
              <div className="flex-shrink-0">
                <V75DatePicker
                  selectedDate={selectedDate}
                  onDateSelect={handleDateSelect}
                />
              </div>
              <Popover open={gamePickerOpen} onOpenChange={setGamePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!selectedDate}
                    className="h-9 flex-shrink-0 min-w-0 max-w-[15rem] justify-start font-medium"
                  >
                    <Trophy className="h-3.5 w-3.5 mr-2 flex-shrink-0" />
                    <span className="truncate">{selectionLabel}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[320px] p-2 max-h-[70vh] overflow-y-auto">
                  <GamePicker
                    games={dayGames ?? []}
                    selectedGameId={selectedGame?.gameId}
                    loading={isLoadingDay}
                    onSelect={handleGameSelect}
                  />
                </PopoverContent>
              </Popover>
              <Button
                size="sm"
                onClick={handleAnalyzeV75}
                disabled={isAnalyzing || !isDataReady}
                title={!selectedGame ? 'Välj datum och spel först' : undefined}
                className="flex-shrink-0 h-9 font-bold tracking-wide"
              >
                <Play className="h-4 w-4" />
                <span className="text-sm">
                  {isAnalyzing ? "Analyserar…" : isFetching ? "Laddar…" : "Analysera"}
                </span>
              </Button>
              {v75Results.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportV75ToExcel(v75Results, analysisDate, analysisGameType ?? gameType)}
                  title="Export to Excel"
                  className="flex-shrink-0 h-9"
                >
                  <Download className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Desktop right: tools */}
            <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
              <Button variant="ghost" size="icon" onClick={() => setShowWeights((v) => !v)} title="Weights" className="h-9 w-9">
                <Settings2 className="h-4 w-4" />
              </Button>
              <ThemeToggle />
            </div>

            {/* Mobile right: game/date chip + menu — only 2 controls, nothing can overflow */}
            <div className="flex sm:hidden items-center gap-1.5 flex-shrink-0">
              <Popover open={chipOpen} onOpenChange={setChipOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-11 rounded-full px-4 text-xs font-bold num border-foreground/40"
                  >
                    <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                    {selectedGame ? GAME_TYPE_LABELS[selectedGame.gameType] : "Välj"}
                    {selectedDate ? ` · ${format(selectedDate, "d/M")}` : ""}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[320px] p-3 max-h-[80vh] overflow-y-auto">
                  <div className="eyebrow mb-1">Datum</div>
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateSelect}
                    captionLayout="dropdown-buttons"
                    fromYear={2020}
                    toYear={new Date().getFullYear() + 1}
                    className="p-0 pointer-events-auto"
                  />
                  {selectedDate && (
                    <>
                      <div className="eyebrow mt-3 mb-1">Spel</div>
                      <GamePicker
                        games={dayGames ?? []}
                        selectedGameId={selectedGame?.gameId}
                        loading={isLoadingDay}
                        onSelect={handleGameSelect}
                      />
                    </>
                  )}
                </PopoverContent>
              </Popover>
              <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-11 w-11" title="Menu">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-72">
                  <SheetHeader className="text-left border-b-2 border-foreground/70 pb-3">
                    <SheetTitle className="font-display italic font-bold">TrotAnalyzer</SheetTitle>
                  </SheetHeader>
                  <nav className="mt-3 flex flex-col">
                    {v75Results.length > 0 && (
                      <button
                        onClick={() => { exportV75ToExcel(v75Results, analysisDate, analysisGameType ?? gameType); setMenuOpen(false); }}
                        className="flex items-center gap-3 h-12 px-3 rounded-md text-sm font-medium hover:bg-muted transition-colors"
                      >
                        <Download className="h-4 w-4 text-muted-foreground" /> Export to Excel
                      </button>
                    )}
                    <button
                      onClick={() => { setShowWeights((v) => !v); setMenuOpen(false); }}
                      className="flex items-center gap-3 h-12 px-3 rounded-md text-sm font-medium hover:bg-muted transition-colors"
                    >
                      <Settings2 className="h-4 w-4 text-muted-foreground" /> Weights
                    </button>
                    <div className="flex items-center justify-between h-12 px-3 text-sm font-medium">
                      <span>Theme</span>
                      <ThemeToggle />
                    </div>
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>

        {/* Mobile primary action — full-width, impossible to miss */}
        <div className="sm:hidden container mx-auto px-3 pb-2.5">
          <Button
            onClick={handleAnalyzeV75}
            disabled={isAnalyzing || !isDataReady}
            title={!selectedGame ? 'Välj datum och spel först' : undefined}
            className="w-full h-12 text-sm font-bold tracking-widest uppercase"
          >
            <Play className="h-4 w-4 mr-1.5" />
            {isAnalyzing ? "Analyserar…" : isFetching ? "Laddar…" : "Analysera loppen"}
          </Button>
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
            title="Today's racing program"
            description="Pick a date, then pick from every game running that day — the whole card ranked by predicted km-time, with odds, spelprocent and barfota signals."

            icon={<Trophy className="h-6 w-6" />}
          />
        )}

        {/* React Query error display */}
        {(dayError || raceError) && (
          <AnalyzerCard>
            <div className="space-y-3">
              <ErrorDisplay
                error={dayError ? `Failed to fetch the race day: ${dayError.message}` : `Failed to fetch race data: ${raceError?.message}`}
              />
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    handleDateSelect(undefined);
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
