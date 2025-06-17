
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Clock, TrendingUp, User, Zap, Star } from "lucide-react";

interface HorseCardProps {
  horse: any;
  rank: number;
  raceInfo: {
    startMethod: string;
    distance: number;
  };
}

const HorseCard: React.FC<HorseCardProps> = ({ horse, rank, raceInfo }) => {
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
    const minutes = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${minutes}:${secs.padStart(4, '0')}`;
  };

  const getFormPercentage = () => {
    // Mock form calculation - in real app this would be calculated from recent races
    return Math.max(0, 100 - (rank - 1) * 15 + Math.random() * 10);
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
              <h3 className="font-bold text-lg text-gray-900">{horse.name}</h3>
              <p className="text-sm text-gray-600">Start #{horse.startNumber}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 text-lg font-semibold text-green-700">
              <Clock className="h-4 w-4" />
              {formatTime(horse.normalizedTime)}
            </div>
            <p className="text-xs text-gray-500">Predicted Time</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-sm font-medium">
              <User className="h-3 w-3" />
              {horse.driver}
            </div>
            <p className="text-xs text-gray-500">Driver</p>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-sm font-medium">
              <Star className="h-3 w-3" />
              {horse.driverWinPercentage}%
            </div>
            <p className="text-xs text-gray-500">Driver Win%</p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-sm font-medium">
              <Zap className="h-3 w-3" />
              {horse.postPosition}
            </div>
            <p className="text-xs text-gray-500">Post Position</p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-sm font-medium">
              <TrendingUp className="h-3 w-3" />
              {horse.recentStarts || 0}
            </div>
            <p className="text-xs text-gray-500">Recent Starts</p>
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
                {item}
              </Badge>
            ))}
          </div>
        )}

        {horse.bestTime && (
          <div className="mt-2 text-xs text-gray-600">
            Best Time: {formatTime(horse.bestTime)} • Earnings: {horse.totalEarnings || "N/A"}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default HorseCard;
