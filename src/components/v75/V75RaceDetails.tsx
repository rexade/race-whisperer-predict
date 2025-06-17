
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trophy, Clock, MapPin, Users } from "lucide-react";
import { V75RaceResult } from './hooks/useV75Analysis';

interface V75RaceDetailsProps {
  race: V75RaceResult;
}

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

      {/* Results Table */}
      <Card>
        <CardHeader>
          <CardTitle>Race Results (Sorted by Normalized Time)</CardTitle>
        </CardHeader>
        
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Pos</TableHead>
                  <TableHead>Horse</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead className="text-center">Post</TableHead>
                  <TableHead className="text-right">RAW Time</TableHead>
                  <TableHead className="text-right">Normalized</TableHead>
                  <TableHead className="text-right">Difference</TableHead>
                  <TableHead className="text-right">Total Adj</TableHead>
                </TableRow>
              </TableHeader>
              
              <TableBody>
                {sortedHorses.map((horse, index) => {
                  const result = horse.modernNormalizedResult!;
                  const rawSeconds = result.rawTime.minutes * 60 + result.rawTime.seconds + result.rawTime.tenths / 10;
                  const normalizedSeconds = result.modernNormalizedTime.minutes * 60 + result.modernNormalizedTime.seconds + result.modernNormalizedTime.tenths / 10;
                  const difference = normalizedSeconds - rawSeconds;
                  
                  return (
                    <TableRow key={horse.horseId}>
                      <TableCell>
                        <Badge className={getPositionColor(index + 1)}>
                          {index + 1}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{horse.horseName}</TableCell>
                      <TableCell>{horse.driverName}</TableCell>
                      <TableCell className="text-center">{horse.postPosition}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatKmTime(result.rawTime)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-purple-600">
                        {formatKmTime(result.modernNormalizedTime)}
                      </TableCell>
                      <TableCell className={`text-right font-mono ${difference >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatAdjustment(difference)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-gray-600">
                        {formatAdjustment(result.adjustments.total)}
                      </TableCell>
                    </TableRow>
                  );
                })}
                
                {horsesWithoutTimes.map(horse => (
                  <TableRow key={horse.horseId} className="opacity-50">
                    <TableCell>-</TableCell>
                    <TableCell className="font-medium">{horse.horseName}</TableCell>
                    <TableCell>{horse.driverName}</TableCell>
                    <TableCell className="text-center">{horse.postPosition}</TableCell>
                    <TableCell className="text-right text-gray-400">No data</TableCell>
                    <TableCell className="text-right text-gray-400">No data</TableCell>
                    <TableCell className="text-right text-gray-400">-</TableCell>
                    <TableCell className="text-right text-gray-400">-</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {horsesWithoutTimes.length > 0 && (
            <p className="text-sm text-gray-500 mt-4">
              {horsesWithoutTimes.length} horse(s) could not be analyzed due to insufficient historical data.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Detailed Adjustments */}
      {sortedHorses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Detailed Adjustments</CardTitle>
          </CardHeader>
          
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Horse</TableHead>
                    <TableHead className="text-right">Post Pos</TableHead>
                    <TableHead className="text-right">Equipment</TableHead>
                    <TableHead className="text-right">Driver</TableHead>
                    <TableHead className="text-right">Driver 2025</TableHead>
                    <TableHead className="text-right">Distance</TableHead>
                    <TableHead className="text-right">Race Type</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                
                <TableBody>
                  {sortedHorses.slice(0, 5).map(horse => {
                    const adj = horse.modernNormalizedResult!.adjustments;
                    return (
                      <TableRow key={horse.horseId}>
                        <TableCell className="font-medium">{horse.horseName}</TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatAdjustment(adj.postPosition)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatAdjustment(adj.equipment)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatAdjustment(adj.driver)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatAdjustment(adj.driver2025)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatAdjustment(adj.distance)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatAdjustment(adj.raceType)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-bold">
                          {formatAdjustment(adj.total)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default V75RaceDetails;
