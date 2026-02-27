
import React from 'react';
import { AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
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

  const getProgressColor = (quality: number) => {
    if (quality >= 80) return '[&>div]:bg-success';
    if (quality >= 60) return '[&>div]:bg-warning';
    return '[&>div]:bg-destructive';
  };

  const qualityLabel =
    dataQuality >= 80 ? 'Good'
    : dataQuality >= 60 ? 'Partial'
    : 'Low';

  return (
    <div className={`p-4 rounded-lg border ${getQualityBg(dataQuality)}`} role="status" aria-label={`Data quality: ${qualityLabel} (${dataQuality}%)`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${dataQuality >= 80 ? 'bg-success' : dataQuality >= 60 ? 'bg-warning' : 'bg-destructive'}`} aria-hidden="true">
            {dataQuality >= 80
              ? <CheckCircle className="h-4 w-4 text-white" />
              : dataQuality >= 60
              ? <AlertTriangle className="h-4 w-4 text-white" />
              : <XCircle className="h-4 w-4 text-white" />
            }
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Data Quality</p>
            <div className="flex items-baseline gap-1.5">
              <p className={`font-bold text-lg tabular-nums leading-none ${getQualityColor(dataQuality)}`}>{dataQuality}%</p>
              <span className={`text-xs font-medium ${getQualityColor(dataQuality)}`}>{qualityLabel}</span>
            </div>
          </div>
        </div>
        <div className="text-sm text-muted-foreground text-right">
          <div><span className="font-medium tabular-nums">{horsesWithStartPoints}</span> / <span className="tabular-nums">{race.horses.length}</span> with start points</div>
          <div><span className="font-medium tabular-nums">{horsesWithEarnings}</span> / <span className="tabular-nums">{race.horses.length}</span> with earnings</div>
        </div>
      </div>
      <Progress
        value={dataQuality}
        className={`mt-3 h-1.5 ${getProgressColor(dataQuality)}`}
        aria-hidden="true"
      />
    </div>
  );
};

export default V75DataQuality;
