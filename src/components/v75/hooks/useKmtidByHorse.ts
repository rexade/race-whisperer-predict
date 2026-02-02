import { useState, useEffect, useCallback } from 'react';
import { fetchKmtidDataByHorseIdForDate, normalizeHorseName } from '@/services/kmtid';
import type { KmtidPerStartAnalytics } from '../types/postRaceAnalysisTypes';

/**
 * Fetch kmtid historical data (~2 weeks old) for the prediction view.
 * Match by horseId first; when kmtid has no stable horse ID (n+1 per race), fall back to normalized horse name.
 */
export function useKmtidByHorse(
  analysisDate: string | null,
  horses: Array<{ horseId: number; horseName: string }>
): {
  kmtidByHorse: Map<number, KmtidPerStartAnalytics> | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const [kmtidByHorse, setKmtidByHorse] = useState<Map<number, KmtidPerStartAnalytics> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const horsesKey = horses.length === 0 ? '' : horses.map((h) => `${h.horseId}:${normalizeHorseName(h.horseName)}`).sort().join('|');

  const fetch = useCallback(async () => {
    if (!analysisDate || horses.length === 0) {
      setKmtidByHorse(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const lookup = await fetchKmtidDataByHorseIdForDate(analysisDate);
      if (!lookup) {
        setKmtidByHorse(null);
        return;
      }
      const resolved = new Map<number, KmtidPerStartAnalytics>();
      for (const horse of horses) {
        const analytics =
          lookup.byHorseId.get(horse.horseId) ??
          lookup.byHorseName.get(normalizeHorseName(horse.horseName));
        if (analytics) resolved.set(horse.horseId, analytics);
      }
      setKmtidByHorse(resolved.size > 0 ? resolved : null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      setKmtidByHorse(null);
    } finally {
      setLoading(false);
    }
  }, [analysisDate, horsesKey]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { kmtidByHorse, loading, error, refetch: fetch };
}
