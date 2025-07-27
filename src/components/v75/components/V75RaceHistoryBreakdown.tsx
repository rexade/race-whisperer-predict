import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Trophy, Calendar, Ruler } from "lucide-react";
import { ProcessedKmTime } from '../../../services/types/kmTimeTypes';
import { formatKmTime } from '../utils/v75DisplayUtils';

interface V75RaceHistoryBreakdownProps {
  horseName: string;
  historicalRaces: ProcessedKmTime[];
  best3Average: { minutes: number; seconds: number; tenths: number };
}

const V75RaceHistoryBreakdown: React.FC<V75RaceHistoryBreakdownProps> = ({ 
  horseName, 
  historicalRaces, 
  best3Average 
}) => {
  // Get the best 3 times (already sorted by normalized time in processing)
  const best3Times = historicalRaces.slice(0, 3);
  
  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm text-blue-800">
          <Clock className="h-4 w-4" />
          Raw KM Time Calculation for {horseName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Summary */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm text-gray-700">Calculation Summary</h4>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">Historical Races:</span>
                <Badge variant="outline" className="text-xs">{historicalRaces.length}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Best 3 Used:</span>
                <Badge variant="outline" className="text-xs">{best3Times.length}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Final Average:</span>
                <Badge className="bg-blue-600 text-white text-xs font-mono">
                  {formatKmTime(best3Average)}
                </Badge>
              </div>
            </div>
          </div>

          {/* Best 3 Times */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm text-gray-700">Best 3 Times Used</h4>
            <div className="space-y-2">
              {best3Times.map((time, index) => (
                <div 
                  key={`${time.raceDate}-${index}`}
                  className="flex items-center justify-between p-2 bg-white rounded border border-gray-200"
                >
                  <div className="flex items-center gap-2">
                    <Badge className={`text-xs ${
                      index === 0 ? 'bg-yellow-500' : 
                      index === 1 ? 'bg-gray-400' : 
                      'bg-amber-600'
                    } text-white`}>
                      {index + 1}
                    </Badge>
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <Calendar className="h-3 w-3" />
                      {time.raceDate}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <Ruler className="h-3 w-3" />
                      {time.distance}m
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {time.startMethod}
                    </Badge>
                    <span className="font-mono text-sm font-semibold text-blue-700">
                      {formatKmTime(time.normalizedTime)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Detailed History (if more than 3 races) */}
        {historicalRaces.length > 3 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm text-gray-700">
              All Historical Races ({historicalRaces.length})
            </h4>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {historicalRaces.map((time, index) => (
                <div 
                  key={`${time.raceDate}-${index}`}
                  className={`flex items-center justify-between p-1 text-xs rounded ${
                    index < 3 ? 'bg-blue-100 border border-blue-200' : 'bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">{time.raceDate}</span>
                    <span className="text-gray-500">{time.distance}m {time.startMethod}</span>
                    {time.finishOrder && (
                      <div className="flex items-center gap-1">
                        <Trophy className="h-3 w-3 text-amber-500" />
                        <span className="text-amber-600">#{time.finishOrder}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-gray-600">
                      {formatKmTime(time.originalTime)}
                    </span>
                    <span className="text-gray-400">→</span>
                    <span className="font-mono font-semibold">
                      {formatKmTime(time.normalizedTime)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="text-xs text-gray-500 italic">
          * Times are normalized to 2140m equivalent for fair comparison
        </div>
      </CardContent>
    </Card>
  );
};

export default V75RaceHistoryBreakdown;