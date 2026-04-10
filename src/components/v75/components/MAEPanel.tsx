
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart2, RefreshCw, AlertCircle } from 'lucide-react';
import { RaceAnalysisCache } from '@/services/v75Cache/raceAnalysisCache';
import {
  fetchAndComputeMAEForRace,
  getAggregateMAEStats,
  type AggregateMAEStats,
} from '@/services/raceMAEService';
import type { RaceMAEResult, RaceAnalysisSummary } from '@/services/v75Cache/types';

/**
 * MAEPanel — shows model rank accuracy over stored V75 predictions.
 *
 * For each race with a stored prediction the user can trigger a one-time
 * re-fetch from ATG to compute rank MAE. The aggregate mean rank error is
 * shown at the top.
 */
const MAEPanel: React.FC = () => {
  const [stats, setStats] = useState<AggregateMAEStats | null>(null);
  const [summaries, setSummaries] = useState<RaceAnalysisSummary[]>([]);
  const [maeMap, setMaeMap] = useState<Map<string, RaceMAEResult>>(new Map());
  const [computing, setComputing] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    const s = await RaceAnalysisCache.getAllRaceAnalyses();
    setSummaries(s);
    const allMae = RaceAnalysisCache.getAllMAEResults();
    setMaeMap(new Map(allMae.map(r => [r.raceId, r])));
    setStats(getAggregateMAEStats());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCompute = async (raceId: string) => {
    setComputing(prev => new Set(prev).add(raceId));
    setErrors(prev => { const next = { ...prev }; delete next[raceId]; return next; });
    try {
      const result = await fetchAndComputeMAEForRace(raceId);
      if (!result) {
        setErrors(prev => ({
          ...prev,
          [raceId]: 'Not finished or no matches',
        }));
      }
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Fetch failed';
      setErrors(prev => ({ ...prev, [raceId]: msg }));
    } finally {
      setComputing(prev => { const next = new Set(prev); next.delete(raceId); return next; });
    }
  };

  if (summaries.length === 0) return null;

  return (
    <Card className="border border-border/60">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <BarChart2 className="h-4 w-4 text-primary" />
          Model Accuracy
          {stats && (
            <Badge variant="secondary" className="ml-auto text-xs tabular-nums">
              Avg ±{stats.meanRankError.toFixed(1)} rank over {stats.raceCount} race{stats.raceCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="space-y-1.5">
          {summaries.map(summary => {
            const mae = maeMap.get(summary.raceId);
            const isComputing = computing.has(summary.raceId);
            const error = errors[summary.raceId];
            return (
              <div
                key={summary.raceId}
                className="flex items-center justify-between gap-2 text-xs py-1 border-b border-border/30 last:border-0"
              >
                <span className="text-muted-foreground tabular-nums">
                  {summary.analysisDate} — Race {summary.raceNumber}
                </span>
                <div className="flex items-center gap-1.5">
                  {mae && (
                    <Badge variant="outline" className="tabular-nums text-xs px-1.5 py-0">
                      ±{mae.meanRankError.toFixed(1)} ({mae.horseCount}h)
                    </Badge>
                  )}
                  {error && (
                    <span className="text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {error}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => void handleCompute(summary.raceId)}
                    disabled={isComputing}
                    title={mae ? 'Recompute MAE' : 'Compute accuracy for this race'}
                  >
                    <RefreshCw className={`h-3 w-3 ${isComputing ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
          Rank error = mean |predicted rank − actual finish|. Lower is better.
          Click <RefreshCw className="h-2.5 w-2.5 inline" /> to fetch ATG results for completed races.
        </p>
      </CardContent>
    </Card>
  );
};

export default MAEPanel;
