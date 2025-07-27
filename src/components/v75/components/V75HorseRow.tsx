
import React, { useState } from 'react';
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Medal, Banknote, Zap, Ruler, ChevronDown, ChevronUp } from "lucide-react";
import { V75HorseResult } from '../hooks/useV75Analysis';
import { ensureStringForDisplay, formatKmTime, formatAdjustment, formatEarnings, getShoesDisplay, getShoesColor, getSulkyDisplay } from '../utils/v75DisplayUtils';
import { V75TimeCalculationDebug } from './V75TimeCalculationDebug';

interface V75HorseRowProps {
  horse: V75HorseResult;
  rank: number;
}

const V75HorseRow: React.FC<V75HorseRowProps> = ({ horse, rank }) => {
  const [showDebug, setShowDebug] = useState(false);
  const result = horse.modernNormalizedResult!;
  const isTopPerformer = rank <= 3;
  
  const safeHorseName = ensureStringForDisplay(horse.horseName);
  const safeDriverName = ensureStringForDisplay(horse.driverName);
  
  // Debug panel available for all horses

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Medal className="h-4 w-4 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-4 w-4 text-gray-400" />;
    if (rank === 3) return <Medal className="h-4 w-4 text-amber-600" />;
    return null;
  };

  const getRankBadgeStyle = (rank: number) => {
    if (rank <= 3) return "bg-gradient-to-r from-green-500 to-green-600 text-white font-bold";
    if (rank <= 5) return "bg-blue-100 text-blue-700 border border-blue-300";
    return "bg-gray-100 text-gray-600";
  };

  return (
    <>
      <TableRow 
        className={`${isTopPerformer ? 'bg-green-50/50 border-l-4 border-l-green-500' : ''} hover:bg-gray-50/50 transition-colors`}
      >
      <TableCell className="text-center sticky left-0 bg-white z-10 border-r">
        <div className="flex items-center justify-center gap-1">
          {getRankIcon(rank)}
          <Badge className={`${getRankBadgeStyle(rank)} text-xs`}>
            {rank}
          </Badge>
        </div>
      </TableCell>
      
      <TableCell className="text-center font-bold text-sm sm:text-lg">
        {horse.postPosition}
      </TableCell>
      
      <TableCell>
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="font-medium text-gray-900 text-xs sm:text-sm truncate">{safeHorseName}</div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDebug(!showDebug)}
              className="h-6 w-6 p-0"
            >
              {showDebug ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </Button>
          </div>
          <div className="text-xs text-gray-600 truncate">{safeDriverName}</div>
        </div>
      </TableCell>
      
      <TableCell className="text-center">
        <div className="font-mono text-xs sm:text-sm text-gray-700">
          <div>{formatKmTime(result.rawTime)}</div>
          <div className="text-xs text-gray-500">Best 3 Avg</div>
        </div>
      </TableCell>
      
      <TableCell className="text-center">
        <div className={`font-mono text-xs sm:text-sm font-bold ${isTopPerformer ? 'text-green-700' : 'text-gray-900'}`}>
          <div>{formatKmTime(result.modernNormalizedTime)}</div>
          <div className="text-xs text-gray-500">Predicted</div>
        </div>
      </TableCell>
      
      <TableCell className="text-center">
        <span className={`text-xs sm:text-sm font-medium ${horse.statistics?.startPoints > 0 ? 'text-blue-700' : 'text-gray-400'}`}>
          {horse.statistics?.startPoints ? horse.statistics.startPoints.toString() : '-'}
        </span>
      </TableCell>
      
      <TableCell className="text-center">
        <span className={`text-xs sm:text-sm font-medium ${horse.statistics?.placePercentage > 0 ? 'text-indigo-700' : 'text-gray-400'}`}>
          {horse.statistics?.placePercentage ? (horse.statistics.placePercentage / 100).toFixed(1) + '%' : '-'}
        </span>
      </TableCell>
      
      <TableCell className="text-center">
        <span className={`text-xs sm:text-sm font-medium ${horse.statistics?.winPercentage > 0 ? 'text-purple-700' : 'text-gray-400'}`}>
          {horse.statistics?.winPercentage ? (horse.statistics.winPercentage / 100).toFixed(1) + '%' : '-'}
        </span>
      </TableCell>
      
      <TableCell className="text-center">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-1">
          <Banknote className={`h-3 w-3 ${horse.statistics?.earningsPerStart > 0 ? 'text-amber-500' : 'text-gray-400'}`} />
          <span className={`text-xs font-medium ${horse.statistics?.earningsPerStart > 0 ? 'text-amber-700' : 'text-gray-400'}`}>
            {horse.statistics?.earningsPerStart > 0 ? formatEarnings(horse.statistics.earningsPerStart) : '-'}
          </span>
        </div>
      </TableCell>
      
      <TableCell className="text-center">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-1">
          <Zap className={`h-3 w-3 ${horse.driver2025WinPercentage > 0 ? 'text-green-500' : 'text-gray-400'}`} />
          <span className={`text-xs font-bold ${horse.driver2025WinPercentage > 0 ? 'text-green-700' : 'text-gray-400'}`}>
            {horse.driver2025WinPercentage ? (horse.driver2025WinPercentage / 100).toFixed(1) + '%' : '-'}
          </span>
        </div>
      </TableCell>
      
      <TableCell className="text-center">
        <Badge variant="outline" className="text-xs border-gray-300">
          {getSulkyDisplay(horse.sulkyType)}
        </Badge>
      </TableCell>
      
      <TableCell className="text-center">
        <span className={`text-xs font-medium ${getShoesColor(horse.shoesFront || false, horse.shoesBack || false)}`}>
          {getShoesDisplay(horse.shoesFront || false, horse.shoesBack || false)}
        </span>
      </TableCell>
      
      <TableCell className="text-center">
        <span className="text-xs text-gray-600 truncate">
          {horse.homeTrack || 'Unknown'}
        </span>
      </TableCell>
      
      <TableCell className="text-center">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-1">
          <Ruler className="h-3 w-3 text-blue-500" />
          <span className="text-xs font-medium text-blue-700">
            {horse.distance}m
          </span>
        </div>
      </TableCell>
      
      <TableCell className="text-center">
        <span className={`text-xs sm:text-sm font-mono font-bold ${isTopPerformer ? 'text-green-700' : 'text-gray-600'}`}>
          {formatAdjustment(result.adjustments.total)}
        </span>
      </TableCell>
      </TableRow>
      
      {showDebug && (
        <TableRow>
          <TableCell colSpan={14} className="p-0">
            <V75TimeCalculationDebug horse={horse} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
};

export default V75HorseRow;
