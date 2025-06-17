
import React from 'react';
import { Badge } from "@/components/ui/badge";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Trophy, Calendar, MapPin, Banknote } from "lucide-react";

interface TableHeaderProps {
  horseCount: number;
  raceInfo: {
    raceId: string;
    raceNumber: number;
    distance: number;
    startMethod: string;
    track: string;
    name: string;
    date: string;
    prize: number;
  };
}

const TableHeader: React.FC<TableHeaderProps> = ({ horseCount, raceInfo }) => {
  const formatPrize = (prize: number) => {
    if (prize >= 1000000) {
      return `${(prize / 1000000).toFixed(1)}M`;
    }
    if (prize >= 1000) {
      return `${(prize / 1000).toFixed(0)}k`;
    }
    return prize.toString();
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('sv-SE');
    } catch {
      return dateStr;
    }
  };

  return (
    <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
      <CardTitle className="flex items-center gap-2 text-purple-800">
        <TrendingUp className="h-5 w-5" />
        Complete Horse Analysis
        <Badge variant="outline" className="ml-2 border-purple-300">
          {horseCount} horses analyzed
        </Badge>
      </CardTitle>
      
      <div className="space-y-2 mt-3">
        <div className="flex items-center gap-2 text-lg font-semibold text-purple-700">
          <Trophy className="h-5 w-5" />
          {raceInfo.name}
        </div>
        
        <div className="flex flex-wrap gap-3 mt-2">
          <Badge variant="outline" className="border-purple-300 flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(raceInfo.date)}
          </Badge>
          <Badge variant="outline" className="border-purple-300">
            Race {raceInfo.raceNumber} • {raceInfo.distance}m
          </Badge>
          <Badge variant="outline" className="border-purple-300">
            {raceInfo.startMethod === "auto" ? "Auto Start" : "Volte Start"}
          </Badge>
          <Badge variant="outline" className="border-purple-300 flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {raceInfo.track}
          </Badge>
          <Badge variant="outline" className="border-purple-300 flex items-center gap-1">
            <Banknote className="h-3 w-3" />
            {formatPrize(raceInfo.prize)} SEK
          </Badge>
        </div>
      </div>
    </CardHeader>
  );
};

export default TableHeader;
