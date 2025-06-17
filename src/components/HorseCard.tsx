
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Clock, TrendingUp, User, Zap, Star, History } from "lucide-react";

interface HorseCardProps {
  horse: any;
  rank: number;
  raceInfo: {
    startMethod: string;
    distance: number;
  };
}

// Safety function to ensure we never render an object as React child
const ensureStringForDisplay = (value: any): string => {
  console.log('🔍 HorseCard - ensureStringForDisplay - Input:', JSON.stringify(value), 'Type:', typeof value);
  
  // If it's already a string, return it
  if (typeof value === 'string') {
    console.log('✅ HorseCard - Value is already a string:', value);
    return value;
  }
  
  // If it's null or undefined
  if (!value) {
    console.warn('⚠️ HorseCard - Value is null/undefined, using fallback');
    return 'Unknown';
  }
  
  // If it's an object with name property
  if (typeof value === 'object' && value !== null) {
    console.log('🔧 HorseCard - Value is an object, attempting to extract name:', JSON.stringify(value));
    
    if ('name' in value && typeof value.name === 'string') {
      console.log('✅ HorseCard - Extracted name from object.name:', value.name);
      return value.name;
    }
    
    // If it's an object with id and name
    if ('id' in value && 'name' in value) {
      const nameValue = (value as any).name;
      if (typeof nameValue === 'string') {
        console.log('✅ HorseCard - Extracted name from id/name object:', nameValue);
        return nameValue;
      }
    }
    
    console.error('❌ HorseCard - Value is an object but no valid name found:', JSON.stringify(value));
    return 'Unknown';
  }
  
  // Fallback for any other type
  console.warn('⚠️ HorseCard - Value is unexpected type:', typeof value, value);
  return String(value) || 'Unknown';
};

const HorseCard: React.FC<HorseCardProps> = ({ horse, rank, raceInfo }) => {
  // CRITICAL: Ensure horse name is always a string before rendering
  const safeHorseName = ensureStringForDisplay(horse.name);
  const safeDriverName = ensureStringForDisplay(horse.driver);
  
  console.log('🛡️ HorseCard - SAFETY CHECK:', {
    originalHorseName: horse.name,
    safeHorseName,
    originalDriver: horse.driver,
    safeDriverName,
    horseNameType: typeof horse.name,
    driverType: typeof horse.driver
  });

  const getRankColor = (rank: number) => {
    if (rank === 1) return "bg-amber-500 text-white";
    if (rank === 2) return "bg-gray-400 text-white";
    if (rank === 3) return "bg-amber-600 text-white";
    return "bg-gray-200 text-gray-700";
  };

  const getRankIcon = (rank: number) => {
    if (rank <= 3) return <Trophy className="h-4 w-4" />;
    return <span className="font-bold">#{rank}</span>;
  };

  const formatTime = (seconds: number) => {
    if (!seconds) return "N/A";
    const minutes = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${minutes}:${secs.padStart(4, '0')}`;
  };

  const getFormPercentage = () => {
    // Calculate form based on historical races and ranking
    const baseForm = Math.max(0, 100 - (rank - 1) * 12);
    const historyBonus = Math.min(20, (horse.validHistoricalRaces || 0) * 2);
    return Math.min(100, baseForm + historyBonus);
  };

  return (
    <Card className={`transition-all duration-200 hover:shadow-lg ${
      rank === 1 ? 'border-amber-400 bg-amber-50' : 
      rank <= 3 ? 'border-green-300 bg-green-50' : 
      'border-gray-200 hover:border-green-300'
    }`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Badge className={`${getRankColor(rank)} px-3 py-1 flex items-center gap-1`}>
              {getRankIcon(rank)}
            </Badge>
            <div>
              <h3 className="font-bold text-lg text-gray-900">{safeHorseName}</h3>
              <div className="text-sm text-gray-600">Start #{horse.startNumber}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 text-lg font-semibold text-green-700">
              <Clock className="h-4 w-4" />
              {formatTime(horse.rawTime)}
            </div>
            <div className="text-xs text-gray-500">RAW Time (Top 3 Avg)</div>
            {horse.validHistoricalRaces > 0 && (
              <div className="flex items-center gap-1 text-xs text-blue-600 mt-1">
                <History className="h-3 w-3" />
                {horse.validHistoricalRaces} races
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-sm font-medium">
              <User className="h-3 w-3" />
              <span className="truncate">{safeDriverName}</span>
            </div>
            <div className="text-xs text-gray-500">Driver</div>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-sm font-medium">
              <Star className="h-3 w-3" />
              {horse.driverWinPercentage?.toFixed(1) || 0}%
            </div>
            <div className="text-xs text-gray-500">Driver Win%</div>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-sm font-medium">
              <Zap className="h-3 w-3" />
              {horse.postPosition}
            </div>
            <div className="text-xs text-gray-500">Post Position</div>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-sm font-medium">
              <TrendingUp className="h-3 w-3" />
              {horse.validHistoricalRaces || 0}
            </div>
            <div className="text-xs text-gray-500">Valid Races</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">Form Rating</span>
            <span className="font-medium">{getFormPercentage().toFixed(1)}%</span>
          </div>
          <Progress value={getFormPercentage()} className="h-2" />
        </div>

        {horse.equipment && horse.equipment.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {horse.equipment.map((item, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {ensureStringForDisplay(item)}
              </Badge>
            ))}
          </div>
        )}

        <div className="mt-2 text-xs text-gray-600 space-y-1">
          {horse.bestTime && (
            <div>Best Time: {formatTime(horse.bestTime)}</div>
          )}
          {horse.rawTime > 0 && (
            <div className="font-medium text-blue-600">
              RAW Time based on {horse.validHistoricalRaces} historical races
            </div>
          )}
          {horse.validHistoricalRaces === 0 && (
            <div className="text-amber-600 font-medium">
              No historical data available
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default HorseCard;
