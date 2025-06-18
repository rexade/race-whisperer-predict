
import React from 'react';
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Medal, Banknote, Zap, Ruler } from "lucide-react";
import { V75HorseResult } from '../hooks/useV75Analysis';
import { ensureStringForDisplay, formatKmTime, formatAdjustment, formatEarnings, getShoesDisplay, getShoesColor } from '../utils/v75DisplayUtils';

interface V75HorseRowProps {
  horse: V75HorseResult;
  rank: number;
}

const V75HorseRow: React.FC<V75HorseRowProps> = ({ horse, rank }) => {
  const result = horse.modernNormalizedResult!;
  const isTopPerformer = rank <= 3;
  
  // CRITICAL: Ensure horse name is always a string before rendering - TRIPLE CHECK
  const safeHorseName = ensureStringForDisplay(horse.horseName);
  const safeDriverName = ensureStringForDisplay(horse.driverName);
  
  console.log(`🛡️ V75HorseRow - FINAL RENDER CHECK - Horse ${horse.horseId}: 
    Original horseName: ${JSON.stringify(horse.horseName)} (${typeof horse.horseName})
    Safe horseName: "${safeHorseName}" (${typeof safeHorseName})
    Original driverName: ${JSON.stringify(horse.driverName)} (${typeof horse.driverName})
    Safe driverName: "${safeDriverName}" (${typeof safeDriverName})`);
  
  // Additional validation
  if (typeof safeHorseName !== 'string') {
    console.error('🚨 CRITICAL ERROR - safeHorseName is not a string!', safeHorseName);
    throw new Error(`Horse name safety check failed for horse ${horse.horseId}`);
  }
  
  if (typeof safeDriverName !== 'string') {
    console.error('🚨 CRITICAL ERROR - safeDriverName is not a string!', safeDriverName);
    throw new Error(`Driver name safety check failed for horse ${horse.horseId}`);
  }

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
    <TableRow 
      className={`${isTopPerformer ? 'bg-green-50/50 border-l-4 border-l-green-500' : ''} hover:bg-gray-50/50 transition-colors`}
    >
      <TableCell className="text-center">
        <div className="flex items-center justify-center gap-1">
          {getRankIcon(rank)}
          <Badge className={getRankBadgeStyle(rank)}>
            {rank}
          </Badge>
        </div>
      </TableCell>
      
      <TableCell className="text-center font-bold text-lg">
        {horse.postPosition}
      </TableCell>
      
      <TableCell>
        <div className="space-y-1">
          <div className="font-medium text-gray-900">{safeHorseName}</div>
          <div className="text-sm text-gray-600">{safeDriverName}</div>
        </div>
      </TableCell>
      
      <TableCell className="text-center">
        <div className="font-mono text-sm text-gray-700">
          {formatKmTime(result.rawTime)}
        </div>
      </TableCell>
      
      <TableCell className="text-center">
        <div className={`font-mono text-sm font-bold ${isTopPerformer ? 'text-green-700' : 'text-gray-900'}`}>
          {formatKmTime(result.modernNormalizedTime)}
        </div>
      </TableCell>
      
      <TableCell className="text-center">
        <span className={`text-sm font-medium ${horse.statistics?.startPoints > 0 ? 'text-blue-700' : 'text-gray-400'}`}>
          {horse.statistics?.startPoints ? horse.statistics.startPoints.toString() : '-'}
        </span>
      </TableCell>
      
      <TableCell className="text-center">
        <span className={`text-sm font-medium ${horse.statistics?.placePercentage > 0 ? 'text-indigo-700' : 'text-gray-400'}`}>
          {horse.statistics?.placePercentage ? (horse.statistics.placePercentage / 100).toFixed(1) + '%' : '-'}
        </span>
      </TableCell>
      
      <TableCell className="text-center">
        <span className={`text-sm font-medium ${horse.statistics?.winPercentage > 0 ? 'text-purple-700' : 'text-gray-400'}`}>
          {horse.statistics?.winPercentage ? (horse.statistics.winPercentage / 100).toFixed(1) + '%' : '-'}
        </span>
      </TableCell>
      
      <TableCell className="text-center">
        <div className="flex items-center justify-center gap-1">
          <Banknote className={`h-3 w-3 ${horse.statistics?.earningsPerStart > 0 ? 'text-amber-500' : 'text-gray-400'}`} />
          <span className={`text-sm font-medium ${horse.statistics?.earningsPerStart > 0 ? 'text-amber-700' : 'text-gray-400'}`}>
            {horse.statistics?.earningsPerStart > 0 ? formatEarnings(horse.statistics.earningsPerStart) : '-'}
          </span>
        </div>
      </TableCell>
      
      <TableCell className="text-center">
        <div className="flex items-center justify-center gap-1">
          <Zap className={`h-3 w-3 ${horse.driver2025WinPercentage > 0 ? 'text-green-500' : 'text-gray-400'}`} />
          <span className={`text-sm font-bold ${horse.driver2025WinPercentage > 0 ? 'text-green-700' : 'text-gray-400'}`}>
            {horse.driver2025WinPercentage ? (horse.driver2025WinPercentage / 100).toFixed(1) + '%' : '-'}
          </span>
        </div>
      </TableCell>
      
      <TableCell className="text-center">
        <Badge variant="outline" className="text-xs border-gray-300">
          {horse.sulkyType || 'VA'}
        </Badge>
      </TableCell>
      
      <TableCell className="text-center">
        <span className={`text-xs font-medium ${getShoesColor(horse.shoesFront || false, horse.shoesBack || false)}`}>
          {getShoesDisplay(horse.shoesFront || false, horse.shoesBack || false)}
        </span>
      </TableCell>
      
      <TableCell className="text-center">
        <span className="text-xs text-gray-600">
          {horse.homeTrack || 'Unknown'}
        </span>
      </TableCell>
      
      <TableCell className="text-center">
        <div className="flex items-center justify-center gap-1">
          <Ruler className="h-3 w-3 text-blue-500" />
          <span className="text-xs font-medium text-blue-700">
            {horse.distance}m
          </span>
        </div>
      </TableCell>
      
      <TableCell className="text-center">
        <span className={`text-sm font-mono font-bold ${isTopPerformer ? 'text-green-700' : 'text-gray-600'}`}>
          {formatAdjustment(result.adjustments.total)}
        </span>
      </TableCell>
    </TableRow>
  );
};

export default V75HorseRow;
