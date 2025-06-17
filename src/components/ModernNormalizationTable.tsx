
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, Clock, Trophy, Settings, Medal } from "lucide-react";
import { EnhancedHorseData } from '../services/enhancedAtgApi';
import { ModernNormalizedResult } from '../services/modernNormalization';

interface ModernNormalizationTableProps {
  horses: EnhancedHorseData[];
  results: ModernNormalizedResult[];
  raceInfo: {
    raceNumber: number;
    distance: number;
    startMethod: string;
    track: string;
  };
}

const ModernNormalizationTable: React.FC<ModernNormalizationTableProps> = ({ 
  horses, 
  results, 
  raceInfo 
}) => {
  // Combine horse data with results and sort by modern normalized time
  const combinedData = horses.map((horse, index) => ({
    ...horse,
    result: results[index]
  })).sort((a, b) => (a.result?.modernNormalizedTime || 999) - (b.result?.modernNormalizedTime || 999));

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

  return (
    <Card className="border-purple-200 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
        <CardTitle className="flex items-center gap-2 text-purple-800">
          <TrendingUp className="h-5 w-5" />
          Modern Normalization Results
          <Badge variant="outline" className="ml-2 border-purple-300">
            {combinedData.length} horses analyzed
          </Badge>
        </CardTitle>
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge variant="outline" className="border-purple-300">
            Race {raceInfo.raceNumber} • {raceInfo.distance}m
          </Badge>
          <Badge variant="outline" className="border-purple-300">
            {raceInfo.startMethod === "auto" ? "Auto Start" : "Volte Start"}
          </Badge>
          <Badge variant="outline" className="border-purple-300">
            {raceInfo.track}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-purple-50">
                <TableHead className="w-16 text-center">Rank</TableHead>
                <TableHead className="w-12 text-center">Start</TableHead>
                <TableHead className="min-w-[150px]">Horse & Driver</TableHead>
                <TableHead className="w-24 text-center">RAW Time</TableHead>
                <TableHead className="w-24 text-center font-bold">Modern Time</TableHead>
                <TableHead className="w-20 text-center">Km Time</TableHead>
                <TableHead className="w-20 text-center">Position</TableHead>
                <TableHead className="w-20 text-center">Equipment</TableHead>
                <TableHead className="w-20 text-center">Driver</TableHead>
                <TableHead className="w-20 text-center">Driver 2025</TableHead>
                <TableHead className="w-24 text-center font-bold">Total Adj</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {combinedData.map((horse, index) => {
                const result = horse.result;
                if (!result) return null;
                
                const rank = index + 1;
                const isTopPerformer = rank <= 3;
                
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
                        <div className="font-medium text-gray-900">{horse.name}</div>
                        <div className="text-sm text-gray-600">
                          {horse.driver.firstName} {horse.driver.lastName}
                        </div>
                        <div className="text-xs text-gray-500">
                          2025: {horse.driver.winPercentage2025.toFixed(1)}% wins
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell className="text-center">
                      <div className="font-mono text-sm text-gray-700">
                        {result.rawTime.toFixed(2)}s
                      </div>
                    </TableCell>
                    
                    <TableCell className="text-center">
                      <div className={`font-mono text-sm font-bold ${isTopPerformer ? 'text-green-700' : 'text-gray-900'}`}>
                        {result.modernNormalizedTime.toFixed(2)}s
                      </div>
                    </TableCell>
                    
                    <TableCell className="text-center">
                      <div className="font-mono text-sm text-blue-600 font-medium">
                        {result.kmTime}
                      </div>
                    </TableCell>
                    
                    <TableCell className="text-center">
                      <span className={`text-xs font-mono font-medium ${getAdjustmentColor(result.adjustments.postPosition)}`}>
                        {formatAdjustment(result.adjustments.postPosition)}
                      </span>
                    </TableCell>
                    
                    <TableCell className="text-center">
                      <span className={`text-xs font-mono font-medium ${getAdjustmentColor(result.adjustments.equipment)}`}>
                        {formatAdjustment(result.adjustments.equipment)}
                      </span>
                    </TableCell>
                    
                    <TableCell className="text-center">
                      <span className={`text-xs font-mono font-medium ${getAdjustmentColor(result.adjustments.driver)}`}>
                        {formatAdjustment(result.adjustments.driver)}
                      </span>
                    </TableCell>
                    
                    <TableCell className="text-center">
                      <span className={`text-xs font-mono font-medium ${getAdjustmentColor(result.adjustments.driver2025)}`}>
                        {formatAdjustment(result.adjustments.driver2025)}
                      </span>
                    </TableCell>
                    
                    <TableCell className="text-center">
                      <span className={`text-sm font-mono font-bold ${isTopPerformer ? 'text-green-700' : getAdjustmentColor(result.adjustments.total)}`}>
                        {formatAdjustment(result.adjustments.total)}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        
        <div className="p-4 bg-gradient-to-r from-gray-50 to-purple-50 border-t">
          <div className="flex flex-wrap items-center gap-6 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>All times normalized to 2140m reference</span>
            </div>
            <div className="flex items-center gap-1">
              <Trophy className="h-4 w-4" />
              <span>Top 3 performers highlighted</span>
            </div>
            <div className="flex items-center gap-1">
              <Settings className="h-4 w-4" />
              <span>Includes 2025 driver performance data</span>
            </div>
            <div className="flex items-center gap-1">
              <Medal className="h-4 w-4" />
              <span>Ranked by predicted performance</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ModernNormalizationTable;
