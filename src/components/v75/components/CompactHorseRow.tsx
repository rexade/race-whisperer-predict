import React, { useState } from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Medal, ChevronDown, ChevronUp, Zap, Banknote, Award } from "lucide-react";
import { V75HorseResult } from '../hooks/useV75Analysis';
import { ensureStringForDisplay, formatKmTime, formatEarnings, getShoesDisplay, getShoesColor, getSulkyDisplay } from '../utils/v75DisplayUtils';
import { V75TimeCalculationDebug } from './V75TimeCalculationDebug';
import { useIsMobile } from '../../../hooks/use-mobile';
import { getLatestKmTimeDisplay } from '../../../services/kmTimeRecords';

interface CompactHorseRowProps {
  horse: V75HorseResult;
  rank: number;
}

const uncertainLabel: Record<string, string> = {
  best_only: "Best raw time used — no valid normalized samples available",
  no_valid_samples: "Fallback estimate — no valid historical samples found",
};

const CompactHorseRow: React.FC<CompactHorseRowProps> = ({ horse, rank }) => {
  const [showDebug, setShowDebug] = useState(false);
  const isMobile = useIsMobile();
  const result = horse.modernNormalizedResult!;
  const isTopPerformer = rank <= 3;
  const safeHorseName = ensureStringForDisplay(horse.horseName);
  const safeDriverName = ensureStringForDisplay(horse.driverName);
  const latestKmTime = horse.kmTimeRecords?.length ? getLatestKmTimeDisplay(horse.kmTimeRecords) : null;

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Medal className="h-4 w-4 text-warning" />;
    if (rank === 2) return <Medal className="h-4 w-4 text-muted-foreground" />;
    if (rank === 3) return <Medal className="h-4 w-4 text-warning/70" />;
    return null;
  };

  const getRowStyle = (rank: number) => {
    if (rank <= 3) return "bg-transparent sm:bg-primary/5 sm:border-l-4 border-l-transparent sm:border-l-primary sm:shadow-sm";
    return "bg-transparent sm:bg-card sm:hover:bg-muted/30";
  };

  const confidenceColor =
    horse.confidence === undefined ? ''
    : horse.confidence >= 80 ? 'text-success'
    : horse.confidence >= 50 ? 'text-warning'
    : 'text-destructive';

  const kmTimeTooltip = latestKmTime
    ? `Km time data from ${latestKmTime.date}${latestKmTime.raceName ? ` — ${latestKmTime.raceName}` : ''}${horse.kmTimeRecords && horse.kmTimeRecords.length > 1 ? ` (${horse.kmTimeRecords.length} races)` : ''}`
    : '';

  return (
    <>
      <div
        className={`${getRowStyle(rank)} p-2 sm:p-3 transition-all duration-200 border-b border-border/60 last:border-b-0 ${isMobile ? 'cursor-pointer' : ''}`}
        onClick={isMobile ? () => setShowDebug(!showDebug) : undefined}
        onKeyDown={isMobile ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowDebug(!showDebug); } } : undefined}
        role={isMobile ? 'button' : undefined}
        tabIndex={isMobile ? 0 : -1}
        aria-expanded={showDebug}
        aria-controls={`breakdown-${horse.horseId}`}
      >
        {/* Main content - always visible */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Rank and Start Position */}
          <div className="flex flex-col items-center gap-1 w-[42px] sm:w-[50px] flex-shrink-0">
            <div className="flex items-center gap-1">
              <span className="w-4 h-4 flex items-center justify-center" aria-hidden="true">
                {getRankIcon(rank)}
              </span>
              <Badge
                className="bg-primary text-primary-foreground font-bold shadow-sm text-xs h-5 w-5 sm:h-6 sm:w-6 flex items-center justify-center p-0 tabular-nums"
                aria-label={`Rank ${rank}`}
              >
                {rank}
              </Badge>
            </div>
            <Badge
              variant="secondary"
              className="text-xs font-bold h-5 w-5 sm:h-6 sm:w-6 flex items-center justify-center p-0 tabular-nums"
              aria-label={`Post position ${horse.postPosition}`}
            >
              {horse.postPosition}
            </Badge>
          </div>

          {/* Horse Info - Primary column */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <div className="font-semibold text-sm leading-tight truncate">{safeHorseName}</div>
                  {/* History source badge */}
                  {horse.historySource === "local" && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary whitespace-nowrap">Local</span>
                  )}
                  {horse.historySource === "abroad" && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground whitespace-nowrap">Abroad</span>
                  )}
                  {horse.historySource === "none" && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground whitespace-nowrap">No data</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="text-xs text-muted-foreground leading-tight truncate">{safeDriverName}</div>
                  {/* Confidence indicator */}
                  {horse.confidence !== undefined && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 cursor-default"
                          aria-label={`Data confidence: ${horse.confidence}%`}
                        >
                          <span className={confidenceColor} aria-hidden="true">●</span>
                          <span className="text-muted-foreground tabular-nums">{horse.confidence}%</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        Data confidence: {horse.confidence}%
                        {horse.confidence < 50 && ' — limited historical data'}
                        {horse.confidence >= 50 && horse.confidence < 80 && ' — moderate data coverage'}
                        {horse.confidence >= 80 && ' — strong data coverage'}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); setShowDebug(!showDebug); }}
                className="hidden sm:inline-flex h-5 w-5 p-0 opacity-60 hover:opacity-100 flex-shrink-0"
                aria-label={showDebug ? 'Collapse normalization breakdown' : 'Expand normalization breakdown'}
                aria-expanded={showDebug}
                aria-controls={`breakdown-${horse.horseId}`}
              >
                {showDebug ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
            </div>
          </div>

          {/* Times — Pred most prominent, Raw + Best secondary */}
          <div className="flex flex-col gap-1 min-w-0">
            {/* Predicted Time */}
            <div className="text-center">
              <div className={`font-mono tabular-nums text-base sm:text-lg font-bold ${isTopPerformer ? 'text-primary' : 'text-foreground'} flex items-center justify-center gap-1`}>
                {horse.uncertain && (
                  <span className="text-warning" aria-hidden="true">≈</span>
                )}
                {formatKmTime(result.modernNormalizedTime)}
                {horse.uncertain && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className="text-[9px] px-1 py-0.5 rounded bg-warning/10 text-warning border border-warning/20 whitespace-nowrap cursor-default"
                        aria-label={uncertainLabel[horse.uncertaintyReason ?? ''] ?? 'Approximation'}
                      >
                        uncertain
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {uncertainLabel[horse.uncertaintyReason ?? ''] ?? 'Approximation'}
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              <div className="text-xs text-primary font-medium">Pred</div>
            </div>

            {/* Raw and Best */}
            <div className="flex gap-2 justify-center">
              <div className="text-center">
                <div className="font-mono tabular-nums text-xs font-medium text-muted-foreground">
                  {horse.rawKmTime ? formatKmTime(horse.rawKmTime) : '—'}
                </div>
                <div className="text-xs text-muted-foreground">Raw</div>
              </div>
              <div className="text-center">
                <div className="font-mono tabular-nums text-xs font-medium text-muted-foreground">
                  {horse.bestRecordTime ? formatKmTime(horse.bestRecordTime) : '—'}
                </div>
                <div className="text-xs text-muted-foreground">Best</div>
              </div>
            </div>
          </div>
        </div>

        {/* Secondary info row */}
        <div className="flex items-center justify-between mt-1 sm:mt-2 gap-2">
          <div className="flex items-center gap-2 text-xs flex-wrap">
            {/* Horse win % */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 cursor-default" aria-label={`Horse win rate: ${horse.statistics?.winPercentage ? (horse.statistics.winPercentage / 100).toFixed(0) : 0}%`}>
                  <span className={`font-medium tabular-nums ${horse.statistics?.winPercentage > 0 ? 'text-success' : 'text-muted-foreground'}`}>
                    {horse.statistics?.winPercentage ? (horse.statistics.winPercentage / 100).toFixed(0) + '%' : '—'}
                  </span>
                  <span className="text-muted-foreground">win</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Horse win rate (career)</TooltipContent>
            </Tooltip>

            {/* Driver win % */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 cursor-default" aria-label={`Driver win rate: ${horse.driver2025WinPercentage ? (horse.driver2025WinPercentage / 100).toFixed(0) : 0}%`}>
                  <Zap className="h-3 w-3 text-success" aria-hidden="true" />
                  <span className={`font-medium tabular-nums ${horse.driver2025WinPercentage > 0 ? 'text-success' : 'text-muted-foreground'}`}>
                    {horse.driver2025WinPercentage ? (horse.driver2025WinPercentage / 100).toFixed(0) + '%' : '—'}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Driver win rate (2025)</TooltipContent>
            </Tooltip>

            {/* Start Points */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 cursor-default" aria-label={`Start points: ${horse.statistics?.startPoints ?? '—'}`}>
                  <Award className="h-3 w-3 text-primary" aria-hidden="true" />
                  <span className={`font-medium tabular-nums ${horse.statistics?.startPoints > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                    {horse.statistics?.startPoints ? horse.statistics.startPoints : '—'}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Start points (form rating)</TooltipContent>
            </Tooltip>

            {/* Earnings per start */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 cursor-default" aria-label={`Earnings per start: ${horse.statistics?.earningsPerStart > 0 ? formatEarnings(horse.statistics.earningsPerStart) : '—'}`}>
                  <Banknote className="h-3 w-3 text-warning" aria-hidden="true" />
                  <span className={`font-medium tabular-nums ${horse.statistics?.earningsPerStart > 0 ? 'text-warning' : 'text-muted-foreground'}`}>
                    {horse.statistics?.earningsPerStart > 0 ? formatEarnings(horse.statistics.earningsPerStart) : '—'}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Earnings per start (class indicator)</TooltipContent>
            </Tooltip>

            {/* Km time detail from records */}
            {latestKmTime && (latestKmTime.first200 != null || latestKmTime.last200 != null || latestKmTime.best100 != null || latestKmTime.actualKMTime != null || latestKmTime.slipstreamDistance != null) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground cursor-default"
                    aria-label={kmTimeTooltip}
                  >
                    {latestKmTime.first200 != null && (
                      <span><span className="font-medium text-foreground/90">First 200:</span> <span className="tabular-nums">{latestKmTime.first200}</span></span>
                    )}
                    {latestKmTime.last200 != null && (
                      <span><span className="font-medium text-foreground/90">Last 200:</span> <span className="tabular-nums">{latestKmTime.last200}</span></span>
                    )}
                    {latestKmTime.best100 != null && latestKmTime.best100 !== 'x' && (
                      <span><span className="font-medium text-foreground/90">Best 100:</span> <span className="tabular-nums">{latestKmTime.best100}</span>{latestKmTime.best100start != null && latestKmTime.best100stop != null ? ` (${latestKmTime.best100start}–${latestKmTime.best100stop}m)` : ''}</span>
                    )}
                    {latestKmTime.actualKMTime != null && latestKmTime.actualKMTime !== 'N/A' && (
                      <span><span className="font-medium text-foreground/90">Km:</span> <span className="tabular-nums">{latestKmTime.actualKMTime}</span></span>
                    )}
                    {latestKmTime.actualDistanceRan != null && typeof latestKmTime.actualDistanceRan === 'number' && (
                      <span><span className="font-medium text-foreground/90">Dist:</span> <span className="tabular-nums">{latestKmTime.actualDistanceRan}m</span></span>
                    )}
                    {latestKmTime.slipstreamDistance != null && latestKmTime.slipstreamDistance !== 'N/A' && typeof latestKmTime.slipstreamDistance === 'number' && (
                      <span><span className="font-medium text-foreground/90">Slip:</span> <span className="tabular-nums">{latestKmTime.slipstreamDistance}m</span></span>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>{kmTimeTooltip}</TooltipContent>
              </Tooltip>
            )}

            {/* Home Track — only if different from race track */}
            {horse.homeTrack && horse.homeTrack !== horse.track && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground" aria-hidden="true">@</span>
                <span className="font-medium text-accent">{horse.homeTrack}</span>
              </div>
            )}

            {/* Equipment */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="text-xs h-4 px-1 cursor-default">
                  {getSulkyDisplay(horse.sulkyType)}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Sulky type</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={`font-medium text-xs cursor-default ${getShoesColor(horse.shoesFront || false, horse.shoesBack || false)}`}>
                  {getShoesDisplay(horse.shoesFront || false, horse.shoesBack || false)}
                </span>
              </TooltipTrigger>
              <TooltipContent>Shoe configuration (front / back)</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      {showDebug && (
        <div id={`breakdown-${horse.horseId}`} className="bg-muted/50 sm:border-b sm:border-border/50">
          <V75TimeCalculationDebug horse={horse} />
        </div>
      )}
    </>
  );
};

export default CompactHorseRow;
