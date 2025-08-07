import React, { useState } from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Medal, ChevronDown, ChevronUp, Zap, Banknote } from "lucide-react";
import { V75HorseResult } from '../hooks/useV75Analysis';
import { ensureStringForDisplay, formatKmTime, formatEarnings, getShoesDisplay, getShoesColor, getSulkyDisplay } from '../utils/v75DisplayUtils';
import { V75TimeCalculationDebug } from './V75TimeCalculationDebug';

interface CompactHorseRowProps {
  horse: V75HorseResult;
  rank: number;
}

const CompactHorseRow: React.FC<CompactHorseRowProps> = ({ horse, rank }) => {
  const [showDebug, setShowDebug] = useState(false);
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
    if (rank <= 3) return "bg-primary text-primary-foreground font-bold shadow-sm";
    if (rank <= 5) return "bg-secondary text-secondary-foreground border border-primary/30 font-medium";
    return "bg-muted text-muted-foreground border border-border";
  };

  const getRowStyle = (rank: number) => {
    if (rank <= 3) return "bg-primary/5 border-l-4 border-l-primary shadow-sm";
    return "bg-card hover:bg-muted/30";
  };

  return (
    <>
      <div className={`${getRowStyle(rank)} p-4 transition-all duration-200 border-b border-border/50`}>
        {/* Main content - always visible */}
        <div className="flex items-center gap-3">
          {/* Rank and Start Position */}
          <div className="flex flex-col items-center gap-1 min-w-[50px]">
            <div className="flex items-center gap-1">
              {getRankIcon(rank)}
              <Badge className={`${getRankBadgeStyle(rank)} text-xs h-6 w-6 flex items-center justify-center p-0`}>
                {rank}
              </Badge>
            </div>
            <Badge variant="outline" className="text-xs font-bold h-6 w-6 flex items-center justify-center p-0">
              {horse.postPosition}
            </Badge>
          </div>

          {/* Horse Info - Primary column */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm truncate">{safeHorseName}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDebug(!showDebug)}
                className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
              >
                {showDebug ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
            </div>
            <div className="text-xs text-muted-foreground truncate">{safeDriverName}</div>
          </div>

          {/* Times - Mobile: Stack vertically, Desktop: Side by side */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 min-w-0">
            {/* Predicted Time - Most important */}
            <div className="text-center">
              <div className={`font-mono text-sm font-bold ${isTopPerformer ? 'text-primary' : 'text-foreground'}`}>
                {formatKmTime(result.modernNormalizedTime)}
              </div>
              <div className="text-xs text-muted-foreground">Pred</div>
            </div>

            {/* Raw Time - Always visible on mobile */}
            <div className="text-center">
              <div className="font-mono text-sm font-bold text-muted-foreground">
                {horse.rawKmTime ? formatKmTime(horse.rawKmTime) : '-'}
              </div>
              <div className="text-xs text-muted-foreground">Raw</div>
            </div>

            {/* Best Record - Desktop only for space */}
            <div className="text-center hidden sm:block">
              <div className="font-mono text-sm font-bold text-warning">
                {horse.bestRecordTime ? formatKmTime(horse.bestRecordTime) : '-'}
              </div>
              <div className="text-xs text-muted-foreground">Best</div>
            </div>
          </div>
        </div>

        {/* Secondary info row - Mobile: Stack, Desktop: Single line */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-3 gap-2">
          <div className="flex items-center gap-3 text-xs flex-wrap">
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
          </div>

          {/* Equipment info */}
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="outline" className="text-xs h-5">
              {getSulkyDisplay(horse.sulkyType)}
            </Badge>
            <span className={`font-medium ${getShoesColor(horse.shoesFront || false, horse.shoesBack || false)}`}>
              {getShoesDisplay(horse.shoesFront || false, horse.shoesBack || false)}
            </span>
          </div>
        </div>

        {/* Mobile-only: Best Record Time row */}
        <div className="sm:hidden mt-2 pt-2 border-t border-border/30">
          <div className="flex items-center justify-center gap-4 text-xs">
            <div className="text-center">
              <div className="font-mono text-sm font-bold text-warning">
                {horse.bestRecordTime ? formatKmTime(horse.bestRecordTime) : '-'}
              </div>
              <div className="text-xs text-muted-foreground">Best Record</div>
            </div>
          </div>
        </div>
      </div>
      
      {showDebug && (
        <div className="bg-muted/50 border-b border-border/50">
          <V75TimeCalculationDebug horse={horse} />
        </div>
      )}
    </>
  );
};

export default CompactHorseRow;