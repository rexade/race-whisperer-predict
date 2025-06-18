
import React from 'react';
import { AlertTriangle } from "lucide-react";
import { V75RaceResult } from '../hooks/useV75Analysis';

interface V75DataQualityProps {
  race: V75RaceResult;
}

const V75DataQuality: React.FC<V75DataQualityProps> = ({ race }) => {
  const horsesWithEarnings = race.horses.filter(h => h.statistics?.earningsPerStart > 0).length;
  const horsesWithStartPoints = race.horses.filter(h => h.statistics?.startPoints > 0).length;
  const dataQuality = race.horses.length > 0 ? Math.round((horsesWithEarnings / race.horses.length) * 100) : 0;

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-orange-500" />
        <span className="text-sm font-medium">Data Quality: {dataQuality}%</span>
      </div>
      <div className="text-sm text-gray-600">
        {horsesWithStartPoints} with start points • {horsesWithEarnings} with earnings
      </div>
    </div>
  );
};

export default V75DataQuality;
