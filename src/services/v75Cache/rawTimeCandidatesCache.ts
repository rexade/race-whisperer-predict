import { CachedRawTimeCandidates, RawTimeCandidateData } from './types';
import { log } from '@/lib/logger';
import { apiHeaders, assertResponseOk, isPersistenceApiEnabled } from '../apiClient';

export class RawTimeCandidatesCache {
  static async fetchUnfilteredCandidates(raceId: string, includeRaw = false): Promise<RawTimeCandidateData | null> {
    if (!isPersistenceApiEnabled()) return null;

    try {
      const resp = await fetch(
        `/api/debug/races/${raceId}/rawtimes-unfiltered${includeRaw ? '?includeRaw=true' : ''}`,
        { headers: apiHeaders() },
      );
      if (!resp.ok) {
        log.warn(`[RawTimeCandidatesCache] Failed to fetch candidates for ${raceId}: ${resp.status}`);
        return null;
      }
      return await resp.json();
    } catch (error) {
      log.error(`[RawTimeCandidatesCache] Error fetching candidates for ${raceId}:`, error);
      return null;
    }
  }

  static async storeCandidates(
    date: string,
    gameId: string,
    raceId: string,
    raceNumber: number,
    candidateData: RawTimeCandidateData
  ): Promise<void> {
    if (!isPersistenceApiEnabled()) return;

    try {
      const response = await fetch('/api/rawtime-candidates', {
        method: 'POST',
        headers: apiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          date,
          gameId,
          raceId,
          raceNumber,
          candidateData,
          schemaVersion: 1,
        }),
      });
      assertResponseOk(response, 'Store raw-time candidates');
      log.info(`[RawTimeCandidatesCache] Cached unfiltered candidates for race ${raceNumber} (${raceId})`);
    } catch (error) {
      log.error('[RawTimeCandidatesCache] Failed to store raw-time candidates:', error);
      throw error;
    }
  }

  static async fetchAndStoreCandidates(
    date: string,
    gameId: string,
    raceId: string,
    raceNumber: number,
    includeRaw = false
  ): Promise<RawTimeCandidateData | null> {
    const candidateData = await this.fetchUnfilteredCandidates(raceId, includeRaw);
    if (!candidateData) return null;
    await this.storeCandidates(date, gameId, raceId, raceNumber, candidateData);
    return candidateData;
  }

  static async getCandidates(raceId: string): Promise<CachedRawTimeCandidates | null> {
    if (!isPersistenceApiEnabled()) return null;

    try {
      const resp = await fetch(`/api/rawtime-candidates/${raceId}`);
      if (!resp.ok) {
        // 404 = cache miss, 5xx = backend error — both mean "no cached candidates"
        if (resp.status !== 404) {
          log.warn(`[RawTimeCandidatesCache] Failed to read candidate cache for ${raceId}: ${resp.status}`);
        }
        return null;
      }
      const data = await resp.json();
      return data || null;
    } catch (error) {
      log.error(`[RawTimeCandidatesCache] Error reading candidate cache for ${raceId}:`, error);
      return null;
    }
  }

  static async clearCandidates(raceId: string): Promise<void> {
    if (!isPersistenceApiEnabled()) return;

    const response = await fetch(
      `/api/rawtime-candidates/${raceId}`,
      { method: 'DELETE', headers: apiHeaders() },
    );
    assertResponseOk(response, `Clear raw-time candidates ${raceId}`);
  }

  static async clearAllCandidates(): Promise<void> {
    if (!isPersistenceApiEnabled()) return;

    const response = await fetch(
      '/api/rawtime-candidates',
      { method: 'DELETE', headers: apiHeaders() },
    );
    assertResponseOk(response, 'Clear raw-time candidates');
  }
}
