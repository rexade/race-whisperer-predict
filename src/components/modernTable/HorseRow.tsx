import React from 'react';
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { Medal, Banknote, Award, Zap, Ruler } from "lucide-react";
import { EnhancedHorseData } from '../../services/enhancedAtgApi';
import { ModernKmNormalizedResult } from '../../services/types/kmTimeTypes';
import { formatKmTime } from '../../services/utils/kmTimeUtils';

interface HorseRowProps {
  horse: EnhancedHorseData;
  result: ModernKmNormalizedResult;
  rank: number;
}

// Safety function to ensure we never render an object as React child
const ensureStringForDisplay = (value: any): string => {
  console.log('🔍 HorseRow - Ensuring string for display:', JSON.stringify(value), 'Type:', typeof value);
  
  if (typeof value === 'string') {
    return value;
  }
  
  if (value && typeof value === 'object') {
    if ('name' in value && typeof value.name === 'string') {
      console.log('✅ HorseRow - Extracted name from object.name:', value.name);
      return value.name;
    }
    if ('id' in value && 'name' in value) {
      console.log('✅ HorseRow - Extracted name from id/name object:', value.name);
      return String(value.name || 'Unknown Horse');
    }
    console.error('❌ HorseRow - Horse name is an object but no valid name found:', JSON.stringify(value));
  }
  
  return String(value || 'Unknown Horse');
};

const HorseRow: React.FC<HorseRowProps> = ({ horse, result, rank }) => {
  const formatAdjustment = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(3)}s`;
  };

  const getAdjustmentColor = (value: number) => {
    if (value > 0.1) return 'text-red-600';
    if (value < -0.1) return 'text-green-600';
    return 'text-gray-600';
  };

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

  const formatEarnings = (earnings: number) => {
    const adjustedEarnings = earnings / 100;
    if (adjustedEarnings >= 1000) {
      return `${(adjustedEarnings / 1000).toFixed(0)}k`;
    }
    return adjustedEarnings.toFixed(0);
  };

  const isBarefootFront = (hasShoe: boolean) => !hasShoe;
  const isBarefootBack = (hasShoe: boolean) => !hasShoe;

  const getShoesDisplay = (frontHasShoe: boolean, backHasShoe: boolean) => {
    const frontBarefoot = isBarefootFront(frontHasShoe);
    const backBarefoot = isBarefootBack(backHasShoe);
    
    if (frontBarefoot && backBarefoot) return "All Barefoot";
    if (frontBarefoot) return "Front Barefoot";
    if (backBarefoot) return "Back Barefoot";
    return "Shod";
  };

  const getShoesColor = (frontHasShoe: boolean, backHasShoe: boolean) => {
    const frontBarefoot = isBarefootFront(frontHasShoe);
    const backBarefoot = isBarefootBack(backHasShoe);
    
    if (frontBarefoot || backBarefoot) return "text-orange-600 font-medium";
    return "text-gray-600";
  };

  const isTopPerformer = rank <= 3;

  // Ensure horse name is safely extracted as string
  const safeHorseName = ensureStringForDisplay(horse.name);
  console.log('🛡️ HorseRow - Final safety check, horse name:', safeHorseName, 'Original:', horse.name);

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
          <div className="text-sm text-gray-600">
            {horse.driver.firstName} {horse.driver.lastName}
          </div>
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
        <span className="text-sm font-medium text-blue-700">
          {horse.statistics.startPoints}
        </span>
      </TableCell>
      
      <TableCell className="text-center">
        <span className="text-sm font-medium text-indigo-700">
          {(horse.statistics.placePercentage / 100).toFixed(1)}%
        </span>
      </TableCell>
      
      <TableCell className="text-center">
        <span className="text-sm font-medium text-purple-700">
          {(horse.statistics.winPercentage / 100).toFixed(1)}%
        </span>
      </TableCell>
      
      <TableCell className="text-center">
        <div className="flex items-center justify-center gap-1">
          <Banknote className="h-3 w-3 text-amber-500" />
          <span className="text-sm font-medium text-amber-700">
            {formatEarnings(horse.statistics.earningsPerStart)}
          </span>
        </div>
      </TableCell>
      
      <TableCell className="text-center">
        <div className="flex items-center justify-center gap-1">
          <Zap className="h-3 w-3 text-green-500" />
          <span className="text-sm font-bold text-green-700">
            {(horse.driver.winPercentage2025 / 100).toFixed(1)}%
          </span>
        </div>
      </TableCell>
      
      <TableCell className="text-center">
        <Badge variant="outline" className="text-xs border-gray-300">
          {horse.sulky.type}
        </Badge>
      </TableCell>
      
      <TableCell className="text-center">
        <span className={`text-xs font-medium ${getShoesColor(horse.shoes.front, horse.shoes.back)}`}>
          {getShoesDisplay(horse.shoes.front, horse.shoes.back)}
        </span>
      </TableCell>
      
      <TableCell className="text-center">
        <span className="text-xs text-gray-600">
          {horse.homeTrack}
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
        <span className={`text-sm font-mono font-bold ${isTopPerformer ? 'text-green-700' : getAdjustmentColor(result.adjustments.total)}`}>
          {formatAdjustment(result.adjustments.total)}
        </span>
      </TableCell>
    </TableRow>
  );
};

export default HorseRow;
