
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, Clock, Trophy, Settings } from "lucide-react";
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

  return (
    <Card className="border-purple-200">
      <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
        <CardTitle className="flex items-center gap-2 text-purple-800">
          <TrendingUp className="h-5 w-5" />
          Modern Normalization Results
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
                <TableHead className="w-12">Rank</TableHead>
                <TableHead className="w-12">Start</TableHead>
                <TableHead className="min-w-[150px]">Horse</TableHead>
                <TableHead className="min-w-[120px]">Driver</TableHead>
                <TableHead className="w-20">Post</TableHead>
                <TableHead className="w-24">RAW Time</TableHead>
                <TableHead className="w-24">Modern Time</TableHead>
                <TableHead className="w-20">Km Time</TableHead>
                <TableHead className="w-20">Position</TableHead>
                <TableHead className="w-20">Equipment</TableHead>
                <TableHead className="w-20">Driver Exp</TableHead>
                <TableHead className="w-20">Driver 2025</TableHead>
                <TableHead className="w-20">Total Adj</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {combinedData.map((horse, index) => {
                const result = horse.result;
                if (!result) return null;
                
                return (
                  <TableRow key={horse.horseId} className={index < 3 ? 'bg-green-50' : ''}>
                    <TableCell>
                      <Badge 
                        variant={index < 3 ? "default" : "secondary"}
                        className={index < 3 ? "bg-green-600 text-white" : ""}
                      >
                        {index + 1}
                      </Badge>
                    </TableCell>
                    
                    <TableCell className="font-medium">
                      {horse.postPosition}
                    </TableCell>
                    
                    <TableCell>
                      <div className="font-medium">{horse.name}</div>
                    </TableCell>
                    
                    <TableCell>
                      <div>
                        <div className="font-medium text-sm">
                          {horse.driver.firstName} {horse.driver.lastName}
                        </div>
                        <div className="text-xs text-gray-500">
                          2025: {horse.driver.winPercentage2025.toFixed(1)}%
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {horse.postPosition}
                      </Badge>
                    </TableCell>
                    
                    <TableCell className="font-mono text-sm">
                      {result.rawTime.toFixed(2)}s
                    </TableCell>
                    
                    <TableCell className="font-mono text-sm font-medium">
                      {result.modernNormalizedTime.toFixed(2)}s
                    </TableCell>
                    
                    <TableCell className="font-mono text-sm text-blue-600">
                      {result.kmTime}
                    </TableCell>
                    
                    <TableCell>
                      <span className={`text-xs font-mono ${getAdjustmentColor(result.adjustments.postPosition)}`}>
                        {formatAdjustment(result.adjustments.postPosition)}
                      </span>
                    </TableCell>
                    
                    <TableCell>
                      <span className={`text-xs font-mono ${getAdjustmentColor(result.adjustments.equipment)}`}>
                        {formatAdjustment(result.adjustments.equipment)}
                      </span>
                    </TableCell>
                    
                    <TableCell>
                      <span className={`text-xs font-mono ${getAdjustmentColor(result.adjustments.driver)}`}>
                        {formatAdjustment(result.adjustments.driver)}
                      </span>
                    </TableCell>
                    
                    <TableCell>
                      <span className={`text-xs font-mono ${getAdjustmentColor(result.adjustments.driver2025)}`}>
                        {formatAdjustment(result.adjustments.driver2025)}
                      </span>
                    </TableCell>
                    
                    <TableCell>
                      <span className={`text-sm font-mono font-medium ${getAdjustmentColor(result.adjustments.total)}`}>
                        {formatAdjustment(result.adjustments.total)}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        
        <div className="p-4 bg-gray-50 border-t">
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>All times normalized to 2140m reference</span>
            </div>
            <div className="flex items-center gap-1">
              <Trophy className="h-4 w-4" />
              <span>Top 3 highlighted in green</span>
            </div>
            <div className="flex items-center gap-1">
              <Settings className="h-4 w-4" />
              <span>Includes 2025 driver performance</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ModernNormalizationTable;
