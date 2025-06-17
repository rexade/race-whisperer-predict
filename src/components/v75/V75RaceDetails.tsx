import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trophy, Clock, MapPin, Users, Medal, Banknote, Zap, Ruler } from "lucide-react";
import { V75RaceResult } from './hooks/useV75Analysis';

interface V75RaceDetailsProps {
  race: V75RaceResult;
}

// Final safety function to ensure we never render an object as React child
const ensureStringForDisplay = (value: any): string => {
  if (typeof value === 'string') {
    return value;
  }
  
  if (value && typeof value === 'object') {
    if ('name' in value && typeof value.name === 'string') {
      return value.name;
    }
    if ('id' in value && 'name' in value) {
      return String(value.name || 'Unknown Horse');
    }
  }
  
  return String(value || 'Unknown Horse');
};

const V75RaceDetails: React.FC<V75RaceDetailsProps> = ({ race }) => {
  const formatKmTime = (time: { minutes: number; seconds: number; tenths: number }) => {
    return `${time.minutes}:${time.seconds.toString().padStart(2, '0')}.${time.tenths}`;
  };

  const formatAdjustment = (adjustment: number) => {
    const sign = adjustment >= 0 ? '+' : '';
    return `${sign}${adjustment.toFixed(3)}s`;
  };

  const getPositionColor = (position: number) => {
    if (position === 1) return 'bg-yellow-100 text-yellow-800';
    if (position === 2) return 'bg-gray-100 text-gray-800';
    if (position === 3) return 'bg-orange-100 text-orange-800';
    return 'bg-blue-100 text-blue-800';
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

  const getShoesDisplay = (frontHasShoe: boolean, backHasShoe: boolean) => {
    const frontBarefoot = !frontHasShoe;
    const backBarefoot = !backHasShoe;
    
    if (frontBarefoot && backBarefoot) return "All Barefoot";
    if (frontBarefoot) return "Front Barefoot";
    if (backBarefoot) return "Back Barefoot";
    return "Shod";
  };

  const getShoesColor = (frontHasShoe: boolean, backHasShoe: boolean) => {
    const frontBarefoot = !frontHasShoe;
    const backBarefoot = !backHasShoe;
    
    if (frontBarefoot || backBarefoot) return "text-orange-600 font-medium";
    return "text-gray-600";
  };

  // Sort horses by normalized time (fastest first)
  const sortedHorses = race.horses
    .filter(horse => horse.modernNormalizedResult)
    .sort((a, b) => {
      const timeA = a.modernNormalizedResult!.modernNormalizedTime;
      const timeB = b.modernNormalizedResult!.modernNormalizedTime;
      
      const totalSecondsA = timeA.minutes * 60 + timeA.seconds + timeA.tenths / 10;
      const totalSecondsB = timeB.minutes * 60 + timeB.seconds + timeB.tenths / 10;
      
      return totalSecondsA - totalSecondsB;
    });

  const horsesWithoutTimes = race.horses.filter(horse => !horse.modernNormalizedResult);

  if (!race.analysisComplete) {
    return (
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600 flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Race {race.raceNumber} - Analysis Failed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            Unable to analyze this race. This could be due to missing data or API issues.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Race Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Race {race.raceNumber}: {race.name}
          </CardTitle>
        </CardHeader>
        
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-500" />
              <span>{race.track}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <span>{race.distance}m {race.startMethod}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-500" />
              <span>{race.horses.length} horses</span>
            </div>
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-gray-500" />
              <span>{(race.prize / 1000000).toFixed(1)}M SEK</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Results Table */}
      <Card className="border-purple-200 shadow-lg">
        <CardHeader>
          <CardTitle>Enhanced Race Analysis (Sorted by Normalized Time)</CardTitle>
        </CardHeader>
        
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-purple-50">
                  <TableHead className="w-16 text-center">Rank</TableHead>
                  <TableHead className="w-12 text-center">Start</TableHead>
                  <TableHead className="min-w-[150px]">Horse & Driver</TableHead>
                  <TableHead className="w-24 text-center">RAW Time (KM)</TableHead>
                  <TableHead className="w-24 text-center font-bold">Modern Time (KM)</TableHead>
                  <TableHead className="w-20 text-center">Start Points</TableHead>
                  <TableHead className="w-20 text-center">Place %</TableHead>
                  <TableHead className="w-20 text-center">Horse Win%</TableHead>
                  <TableHead className="w-20 text-center">Earnings/Start</TableHead>
                  <TableHead className="w-20 text-center">Driver 2025%</TableHead>
                  <TableHead className="w-20 text-center">Sulky</TableHead>
                  <TableHead className="w-24 text-center">Shoes</TableHead>
                  <TableHead className="w-20 text-center">Home Track</TableHead>
                  <TableHead className="w-20 text-center">Distance</TableHead>
                  <TableHead className="w-24 text-center font-bold">Total Adj</TableHead>
                </TableRow>
              </TableHeader>
              
              <TableBody>
                {sortedHorses.map((horse, index) => {
                  const result = horse.modernNormalizedResult!;
                  const rank = index + 1;
                  const isTopPerformer = rank <= 3;
                  
                  // Ensure horse name is always a string before rendering
                  const safeHorseName = ensureStringForDisplay(horse.horseName);
                  console.log('Final render check - Horse name:', safeHorseName, 'Original:', horse.horseName, 'Type:', typeof horse.horseName);
                  
                  return (
                    <TableRow 
                      key={horse.horseId}
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
                          <div className="text-sm text-gray-600">{horse.driverName}</div>
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
                          {horse.statistics?.startPoints || '-'}
                        </span>
                      </TableCell>
                      
                      <TableCell className="text-center">
                        <span className="text-sm font-medium text-indigo-700">
                          {horse.statistics?.placePercentage ? (horse.statistics.placePercentage / 100).toFixed(1) + '%' : '-'}
                        </span>
                      </TableCell>
                      
                      <TableCell className="text-center">
                        <span className="text-sm font-medium text-purple-700">
                          {horse.statistics?.winPercentage ? (horse.statistics.winPercentage / 100).toFixed(1) + '%' : '-'}
                        </span>
                      </TableCell>
                      
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Banknote className="h-3 w-3 text-amber-500" />
                          <span className="text-sm font-medium text-amber-700">
                            {horse.statistics?.earningsPerStart ? formatEarnings(horse.statistics.earningsPerStart) : '-'}
                          </span>
                        </div>
                      </TableCell>
                      
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Zap className="h-3 w-3 text-green-500" />
                          <span className="text-sm font-bold text-green-700">
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
                })}
                
                {horsesWithoutTimes.map(horse => {
                  // Ensure horse name is always a string for horses without times too
                  const safeHorseName = ensureStringForDisplay(horse.horseName);
                  
                  return (
                    <TableRow key={horse.horseId} className="opacity-50">
                      <TableCell>-</TableCell>
                      <TableCell className="text-center">{horse.postPosition}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium text-gray-900">{safeHorseName}</div>
                          <div className="text-sm text-gray-600">{horse.driverName}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-gray-400">No data</TableCell>
                      <TableCell className="text-center text-gray-400">No data</TableCell>
                      <TableCell className="text-center text-gray-400">-</TableCell>
                      <TableCell className="text-center text-gray-400">-</TableCell>
                      <TableCell className="text-center text-gray-400">-</TableCell>
                      <TableCell className="text-center text-gray-400">-</TableCell>
                      <TableCell className="text-center text-gray-400">-</TableCell>
                      <TableCell className="text-center text-gray-400">-</TableCell>
                      <TableCell className="text-center text-gray-400">-</TableCell>
                      <TableCell className="text-center text-gray-400">-</TableCell>
                      <TableCell className="text-center text-gray-400">-</TableCell>
                      <TableCell className="text-center text-gray-400">-</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          
          {horsesWithoutTimes.length > 0 && (
            <div className="p-4 bg-gray-50 border-t">
              <p className="text-sm text-gray-500">
                {horsesWithoutTimes.length} horse(s) could not be analyzed due to insufficient historical data.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default V75RaceDetails;
