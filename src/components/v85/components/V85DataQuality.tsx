
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

  const getQualityColor = (quality: number) => {
    if (quality >= 80) return 'text-success';
    if (quality >= 60) return 'text-warning';
    return 'text-destructive';
  };

  const getQualityBg = (quality: number) => {
    if (quality >= 80) return 'bg-success/10 border-success/20';
    if (quality >= 60) return 'bg-warning/10 border-warning/20';
    return 'bg-destructive/10 border-destructive/20';
  };

  return (
    <div className={`flex items-center justify-between p-4 rounded-lg border ${getQualityBg(dataQuality)}`}>
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${dataQuality >= 80 ? 'bg-success' : dataQuality >= 60 ? 'bg-warning' : 'bg-destructive'}`}>
          <AlertTriangle className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Data Quality</p>
          <p className={`font-bold text-lg ${getQualityColor(dataQuality)}`}>{dataQuality}%</p>
        </div>
      </div>
      <div className="text-sm text-muted-foreground">
        <span className="font-medium">{horsesWithStartPoints}</span> with start points • <span className="font-medium">{horsesWithEarnings}</span> with earnings
      </div>
    </div>
  );
};

export default V75DataQuality;
