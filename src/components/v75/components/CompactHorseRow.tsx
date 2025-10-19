import React, { useState } from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Medal, ChevronDown, ChevronUp, Zap, Banknote, Award } from "lucide-react";
import { V75HorseResult } from '../hooks/useV75Analysis';
import { ensureStringForDisplay, formatKmTime, formatEarnings, getShoesDisplay, getShoesColor, getSulkyDisplay } from '../utils/v75DisplayUtils';
import { V75TimeCalculationDebug } from './V75TimeCalculationDebug';
import { useIsMobile } from '../../../hooks/use-mobile';
interface CompactHorseRowProps {
  horse: V75HorseResult;
  rank: number;
}

const CompactHorseRow: React.FC<CompactHorseRowProps> = ({ horse, rank }) => {
  const [showDebug, setShowDebug] = useState(false);
  const isMobile = useIsMobile();
  const result = horse.modernNormalizedResult!;
  const isTopPerformer = rank <= 3;
  const safeHorseName = ensureStringForDisplay(horse.horseName);
  const safeDriverName = ensureStringForDisplay(horse.driverName);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Medal className="h-4 w-4 text-warning" />;
    if (rank === 2) return <Medal className="h-4 w-4 text-muted-foreground" />;
    if (rank === 3) return <Medal className="h-4 w-4 text-warning/70" />;
    return null;
  };

  const getRankBadgeStyle = (rank: number) => {
    return "bg-primary text-primary-foreground font-bold shadow-sm";
  };

  const getRowStyle = (rank: number) => {
    if (rank <= 3) return "bg-transparent sm:bg-primary/5 sm:border-l-4 border-l-transparent sm:border-l-primary sm:shadow-sm";
    return "bg-transparent sm:bg-card sm:hover:bg-muted/30";
  };

  return (
    <>
      <div
        className={`${getRowStyle(rank)} p-2 sm:p-3 transition-all duration-200 border-b border-border/60 last:border-b-0 ${isMobile ? 'cursor-pointer' : ''}`}
        onClick={isMobile ? () => setShowDebug(!showDebug) : undefined}
        onKeyDown={isMobile ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowDebug(!showDebug); } } : undefined}
        role={isMobile ? 'button' : undefined}
        tabIndex={isMobile ? 0 : -1}
        aria-expanded={showDebug}
        aria-controls={`debug-${horse.horseId}`}
      >
        {/* Main content - always visible */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Rank and Start Position */}
          <div className="flex flex-col items-center gap-1 w-[42px] sm:w-[50px] flex-shrink-0">
            <div className="flex items-center gap-1">
              <span className="w-4 h-4 flex items-center justify-center">
                {getRankIcon(rank)}
              </span>
              <Badge className={`${getRankBadgeStyle(rank)} text-xs h-5 w-5 sm:h-6 sm:w-6 flex items-center justify-center p-0`}>
                {rank}
              </Badge>
            </div>
            <Badge variant="secondary" className="text-xs font-bold h-5 w-5 sm:h-6 sm:w-6 flex items-center justify-center p-0">
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
                    <div 
                      className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1"
                      title={`Confidence ${horse.confidence}%`}
                    >
                      <span className={
                        horse.confidence >= 80 ? "text-success" 
                        : horse.confidence >= 50 ? "text-warning" 
                        : "text-destructive"
                      }>●</span>
                      <span className="text-muted-foreground">{horse.confidence}%</span>
                    </div>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); setShowDebug(!showDebug); }}
                className="hidden sm:inline-flex h-5 w-5 p-0 opacity-60 hover:opacity-100 flex-shrink-0"
              >
                {showDebug ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
            </div>
          </div>

          {/* Times - Reordered with Pred as most prominent */}
          <div className="flex flex-col gap-1 min-w-0">
            {/* Predicted Time - Most prominent */}
            <div className="text-center">
              <div className={`font-mono text-base sm:text-lg font-bold ${isTopPerformer ? 'text-primary' : 'text-foreground'}`}>
                {formatKmTime(result.modernNormalizedTime)}
              </div>
              <div className="text-xs text-primary font-medium">Pred</div>
            </div>
            
            {/* Raw and Best in smaller format */}
            <div className="flex gap-2 justify-center">
              <div className="text-center">
                <div className="font-mono text-xs font-medium text-muted-foreground">
                  {horse.rawKmTime ? formatKmTime(horse.rawKmTime) : '-'}
                </div>
                <div className="text-xs text-muted-foreground">Raw</div>
              </div>
              <div className="text-center">
                <div className="font-mono text-xs font-medium text-muted-foreground">
                  {horse.bestRecordTime ? formatKmTime(horse.bestRecordTime) : '-'}
                </div>
                <div className="text-xs text-muted-foreground">Best</div>
              </div>
            </div>
          </div>
        </div>

        {/* Secondary info row - Compact single line */}
        <div className="flex items-center justify-between mt-1 sm:mt-2 gap-2">
          <div className="flex items-center gap-2 text-xs flex-wrap">
            {/* Statistics */}
            <div className="flex items-center gap-1">
              <span className={`font-medium ${horse.statistics?.winPercentage > 0 ? 'text-success' : 'text-muted-foreground'}`}>
                {horse.statistics?.winPercentage ? (horse.statistics.winPercentage / 100).toFixed(0) + '%' : '-'}
              </span>
              <span className="text-muted-foreground">win</span>
            </div>

            {/* Driver Win % */}
            <div className="flex items-center gap-1">
              <Zap className="h-3 w-3 text-success" />
              <span className={`font-medium ${horse.driver2025WinPercentage > 0 ? 'text-success' : 'text-muted-foreground'}`}>
                {horse.driver2025WinPercentage ? (horse.driver2025WinPercentage / 100).toFixed(0) + '%' : '-'}
              </span>
            </div>

            {/* Start Points */}
            <div className="flex items-center gap-1">
              <Award className="h-3 w-3 text-primary" />
              <span className={`font-medium ${horse.statistics?.startPoints > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                {horse.statistics?.startPoints ? horse.statistics.startPoints : '-'}
              </span>
            </div>

            {/* Earnings */}
            <div className="flex items-center gap-1">
              <Banknote className="h-3 w-3 text-warning" />
              <span className={`font-medium ${horse.statistics?.earningsPerStart > 0 ? 'text-warning' : 'text-muted-foreground'}`}>
                {horse.statistics?.earningsPerStart > 0 ? formatEarnings(horse.statistics.earningsPerStart) : '-'}
              </span>
            </div>

            {/* Home Track - Only show if different from race track */}
            {horse.homeTrack && horse.homeTrack !== horse.track && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">@</span>
                <span className="font-medium text-accent">
                  {horse.homeTrack}
                </span>
              </div>
            )}

            {/* Equipment info - Now inline with other stats */}
            <Badge variant="secondary" className="text-xs h-4 px-1">
              {getSulkyDisplay(horse.sulkyType)}
            </Badge>
            <span className={`font-medium text-xs ${getShoesColor(horse.shoesFront || false, horse.shoesBack || false)}`}>
              {getShoesDisplay(horse.shoesFront || false, horse.shoesBack || false)}
            </span>
          </div>
        </div>
      </div>
      
      {showDebug && (
        <div id={`debug-${horse.horseId}`} className="bg-muted/50 sm:border-b sm:border-border/50">
          <V75TimeCalculationDebug horse={horse} />
        </div>
      )}
    </>
  );
};

export default CompactHorseRow;