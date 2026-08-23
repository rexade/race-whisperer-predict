// @vitest-environment node
/**
 * Unit tests for raceMAEService.
 *
 * ATG network calls are mocked. RaceAnalysisCache is mocked with in-memory state
 * so tests are deterministic and never touch localStorage.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchAndComputeMAEForRace, getAggregateMAEStats } from '../raceMAEService';
import type { RaceAnalysisData } from '../v75Cache/types';
import type { ATGRaceData } from '../atgApi';

// ─── Mock atgApi ─────────────────────────────────────────────────────────────
const mockFetchRaceData = vi.fn<() => Promise<ATGRaceData>>();
vi.mock('../atgApi', () => ({
  fetchRaceData: (...args: unknown[]) => mockFetchRaceData(...(args as [])),
}));

// ─── In-memory RaceAnalysisCache mock ────────────────────────────────────────
const _analysisStore: Record<string, RaceAnalysisData> = {};
const _maeStore: Record<string, import('../v75Cache/types').RaceMAEResult> = {};

vi.mock('../v75Cache/raceAnalysisCache', () => ({
  RaceAnalysisCache: {
    getRaceAnalysis: (raceId: string) => _analysisStore[raceId] ?? null,
    storeMAEResult: (r: import('../v75Cache/types').RaceMAEResult) => {
      _maeStore[r.raceId] = r;
    },
    getMAEResult: (raceId: string) => _maeStore[raceId] ?? null,
    getAllMAEResults: () => Object.values(_maeStore),
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeStoredAnalysis(
  raceId: string,
  horseRanks: Array<{
    horseId: number;
    rank: number;
    horseKey?: string;
    startNumber?: number;
    isEstimated?: boolean;
  }>
): RaceAnalysisData {
  return {
    raceId,
    raceNumber: 1,
    analysisDate: '2026-04-05',
    timestamp: '2026-04-05T10:00:00.000Z',
    horses: horseRanks.map(({ horseId, rank, horseKey, startNumber, isEstimated }) => ({
      horseKey,
      horseId,
      horseName: `Horse ${horseId}`,
      startNumber,
      postPosition: rank,
      finalScore: 100 - rank,
      rank,
      isEstimated,
    })),
  };
}

function makeATGResult(starts: Array<{
  horseId: number;
  finishOrder?: number;
  finalPosition?: number;
  startNumber?: number;
}>): ATGRaceData {
  return {
    race: { id: 'r1', name: 'Test Race', date: '2026-04-05', number: 1, distance: 2140, startMethod: 'auto', track: 'Solvalla', status: 'results' },
    starts: starts.map(({ horseId, finishOrder, finalPosition, startNumber }) => ({
      number: startNumber ?? horseId,
      distance: 2140,
      postPosition: 1,
      horse: { name: `Horse ${horseId}`, id: horseId },
      driver: { firstName: 'Test', lastName: 'Driver' },
      result: finalPosition !== undefined || finishOrder !== undefined
        ? { finalPosition, finishOrder }
        : undefined,
    })),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('fetchAndComputeMAEForRace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear in-memory stores
    for (const k in _analysisStore) delete _analysisStore[k];
    for (const k in _maeStore) delete _maeStore[k];
  });

  it('returns null when no stored prediction exists', async () => {
    mockFetchRaceData.mockResolvedValue(makeATGResult([]));
    const result = await fetchAndComputeMAEForRace('unknown-race');
    expect(result).toBeNull();
    expect(mockFetchRaceData).not.toHaveBeenCalled();
  });

  it('returns null when ATG has no finish orders yet', async () => {
    _analysisStore['r1'] = makeStoredAnalysis('r1', [
      { horseId: 1, rank: 1 },
      { horseId: 2, rank: 2 },
    ]);
    mockFetchRaceData.mockResolvedValue(
      makeATGResult([{ horseId: 1 }, { horseId: 2 }]), // no finishOrder
    );
    const result = await fetchAndComputeMAEForRace('r1');
    expect(result).toBeNull();
  });

  it('returns null when fewer than 2 horses match', async () => {
    _analysisStore['r1'] = makeStoredAnalysis('r1', [
      { horseId: 1, rank: 1 },
      { horseId: 2, rank: 2 },
    ]);
    // ATG only has a result for horseId 99 (not in our prediction)
    mockFetchRaceData.mockResolvedValue(
      makeATGResult([{ horseId: 99, finishOrder: 1 }]),
    );
    const result = await fetchAndComputeMAEForRace('r1');
    expect(result).toBeNull();
  });

  it('computes zero MAE when predicted ranks match actual finish exactly', async () => {
    _analysisStore['r1'] = makeStoredAnalysis('r1', [
      { horseId: 1, rank: 1 },
      { horseId: 2, rank: 2 },
      { horseId: 3, rank: 3 },
    ]);
    mockFetchRaceData.mockResolvedValue(
      makeATGResult([
        { horseId: 1, finishOrder: 1 },
        { horseId: 2, finishOrder: 2 },
        { horseId: 3, finishOrder: 3 },
      ]),
    );
    const result = await fetchAndComputeMAEForRace('r1');
    expect(result).not.toBeNull();
    expect(result!.meanRankError).toBe(0);
    expect(result!.horseCount).toBe(3);
  });

  it('computes correct MAE for a partially reversed ranking', async () => {
    // Predicted: 1,2,3 — Actual: 2,1,3
    // Errors: |1-2|=1, |2-1|=1, |3-3|=0 → mean = 2/3 ≈ 0.667
    _analysisStore['r1'] = makeStoredAnalysis('r1', [
      { horseId: 1, rank: 1 },
      { horseId: 2, rank: 2 },
      { horseId: 3, rank: 3 },
    ]);
    mockFetchRaceData.mockResolvedValue(
      makeATGResult([
        { horseId: 1, finishOrder: 2 },
        { horseId: 2, finishOrder: 1 },
        { horseId: 3, finishOrder: 3 },
      ]),
    );
    const result = await fetchAndComputeMAEForRace('r1');
    expect(result!.meanRankError).toBeCloseTo(2 / 3, 5);
    expect(result!.horses).toHaveLength(3);
    const h1 = result!.horses.find(h => h.horseId === 1)!;
    expect(h1.predictedRank).toBe(1);
    expect(h1.actualFinishOrder).toBe(2);
    expect(h1.rankError).toBe(1);
  });

  it('accepts finalPosition and gives it precedence over finishOrder', async () => {
    _analysisStore['r1'] = makeStoredAnalysis('r1', [
      { horseId: 1, rank: 1 },
      { horseId: 2, rank: 2 },
    ]);
    mockFetchRaceData.mockResolvedValue(makeATGResult([
      { horseId: 1, finalPosition: 2, finishOrder: 1 },
      { horseId: 2, finalPosition: 1, finishOrder: 2 },
    ]));

    const result = await fetchAndComputeMAEForRace('r1');

    expect(result!.meanRankError).toBe(1);
    expect(result!.horses.map(h => [h.horseId, h.actualFinishOrder])).toEqual([
      [1, 2],
      [2, 1],
    ]);
  });

  it('excludes galloped / unranked horses (finishOrder undefined)', async () => {
    _analysisStore['r1'] = makeStoredAnalysis('r1', [
      { horseId: 1, rank: 1 },
      { horseId: 2, rank: 2 },
      { horseId: 3, rank: 3 },
    ]);
    mockFetchRaceData.mockResolvedValue(
      makeATGResult([
        { horseId: 1, finishOrder: 1 },
        { horseId: 2 }, // galloped — no finishOrder
        { horseId: 3, finishOrder: 2 },
      ]),
    );
    const result = await fetchAndComputeMAEForRace('r1');
    // Only horses 1 and 3 matched → horse 2 excluded
    expect(result!.horseCount).toBe(2);
    expect(result!.horses.map(h => h.horseId).sort()).toEqual([1, 3]);
  });

  it('excludes explicit estimates and compresses both ranks over real matched horses', async () => {
    _analysisStore['r1'] = makeStoredAnalysis('r1', [
      { horseId: 1, rank: 1, isEstimated: true },
      { horseId: 2, rank: 2, isEstimated: false },
      { horseId: 3, rank: 3, isEstimated: false },
    ]);
    mockFetchRaceData.mockResolvedValue(makeATGResult([
      { horseId: 1, finishOrder: 3 },
      { horseId: 2, finishOrder: 1 },
      { horseId: 3, finishOrder: 2 },
    ]));

    const result = await fetchAndComputeMAEForRace('r1');

    expect(result!.meanRankError).toBe(0);
    expect(result!.horses.map(h => [h.horseId, h.predictedRank, h.actualFinishOrder])).toEqual([
      [2, 1, 1],
      [3, 2, 2],
    ]);
  });

  it('retains literal finish positions while compressing eligible ranks only for MAE', async () => {
    _analysisStore['r1'] = makeStoredAnalysis('r1', [
      { horseId: 1, rank: 1, isEstimated: true },
      { horseId: 2, rank: 2 },
      { horseId: 3, rank: 3 },
    ]);
    mockFetchRaceData.mockResolvedValue(makeATGResult([
      { horseId: 1, finishOrder: 1 },
      { horseId: 2, finishOrder: 2 },
      { horseId: 99, finishOrder: 3 },
      { horseId: 3, finishOrder: 4 },
    ]));

    const result = await fetchAndComputeMAEForRace('r1');

    expect(result!.meanRankError).toBe(0);
    expect(result!.horses.map(h => [
      h.horseId,
      h.actualFinishOrder,
      h.eligibleActualRank,
      h.rankError,
    ])).toEqual([
      [2, 2, 1, 0],
      [3, 4, 2, 0],
    ]);

    const aggregate = await getAggregateMAEStats();
    expect(aggregate!.winRate).toBe(0);
    expect(aggregate!.top3Rate).toBe(1);
  });

  it('matches distinct zero-ID starters by stable key', async () => {
    _analysisStore['r1'] = makeStoredAnalysis('r1', [
      { horseId: 0, horseKey: 'r1:start:3', startNumber: 3, rank: 1 },
      { horseId: 0, horseKey: 'r1:start:7', startNumber: 7, rank: 2 },
    ]);
    mockFetchRaceData.mockResolvedValue(makeATGResult([
      { horseId: 0, startNumber: 3, finishOrder: 2 },
      { horseId: 0, startNumber: 7, finishOrder: 1 },
    ]));

    const result = await fetchAndComputeMAEForRace('r1');

    expect(result!.horseCount).toBe(2);
    expect(result!.meanRankError).toBe(1);
    expect(result!.horses.map(h => h.horseKey)).toEqual(['r1:start:3', 'r1:start:7']);
  });

  it('keeps legacy entries without an estimate marker eligible', async () => {
    _analysisStore['r1'] = makeStoredAnalysis('r1', [
      { horseId: 1, rank: 1 },
      { horseId: 2, rank: 2 },
    ]);
    mockFetchRaceData.mockResolvedValue(makeATGResult([
      { horseId: 1, finishOrder: 1 },
      { horseId: 2, finishOrder: 2 },
    ]));

    expect((await fetchAndComputeMAEForRace('r1'))!.horseCount).toBe(2);
  });

  it('stores the MAE result in cache', async () => {
    _analysisStore['r1'] = makeStoredAnalysis('r1', [
      { horseId: 1, rank: 1 },
      { horseId: 2, rank: 2 },
    ]);
    mockFetchRaceData.mockResolvedValue(
      makeATGResult([
        { horseId: 1, finishOrder: 1 },
        { horseId: 2, finishOrder: 2 },
      ]),
    );
    await fetchAndComputeMAEForRace('r1');
    expect(_maeStore['r1']).toBeDefined();
    expect(_maeStore['r1'].raceId).toBe('r1');
  });
});

describe('getAggregateMAEStats', () => {
  beforeEach(() => {
    for (const k in _maeStore) delete _maeStore[k];
  });

  it('returns null when no MAE results exist', async () => {
    await expect(getAggregateMAEStats()).resolves.toBeNull();
  });

  it('averages mean rank error across all stored races', async () => {
    _maeStore['rA'] = { raceId: 'rA', raceNumber: 1, analysisDate: '2026-04-01', computedAt: '', meanRankError: 1.0, horseCount: 5, horses: [] };
    _maeStore['rB'] = { raceId: 'rB', raceNumber: 2, analysisDate: '2026-04-01', computedAt: '', meanRankError: 3.0, horseCount: 5, horses: [] };
    const stats = await getAggregateMAEStats();
    expect(stats).not.toBeNull();
    expect(stats!.meanRankError).toBeCloseTo(2.0, 5);
    expect(stats!.raceCount).toBe(2);
  });

  it('returns raceCount 1 for a single race', async () => {
    _maeStore['rA'] = { raceId: 'rA', raceNumber: 1, analysisDate: '2026-04-01', computedAt: '', meanRankError: 2.5, horseCount: 7, horses: [] };
    const stats = await getAggregateMAEStats();
    expect(stats!.raceCount).toBe(1);
    expect(stats!.meanRankError).toBe(2.5);
  });

  it('computes winRate = 0 and top3Rate = 0 when no rank-1 pick exists in results', async () => {
    _maeStore['rA'] = { raceId: 'rA', raceNumber: 1, analysisDate: '2026-04-01', computedAt: '', meanRankError: 2.0, horseCount: 2, horses: [] };
    const stats = await getAggregateMAEStats();
    expect(stats!.winRate).toBe(0);
    expect(stats!.top3Rate).toBe(0);
  });

  it('counts winRate = 1.0 when rank-1 pick won every race', async () => {
    const winner = (raceId: string): import('../v75Cache/types').RaceMAEResult => ({
      raceId, raceNumber: 1, analysisDate: '2026-04-01', computedAt: '', meanRankError: 1.0, horseCount: 3,
      horses: [
        { horseId: 1, horseName: 'A', predictedRank: 1, actualFinishOrder: 1, rankError: 0 },
        { horseId: 2, horseName: 'B', predictedRank: 2, actualFinishOrder: 2, rankError: 0 },
      ],
    });
    _maeStore['rA'] = winner('rA');
    _maeStore['rB'] = winner('rB');
    const stats = await getAggregateMAEStats();
    expect(stats!.winRate).toBe(1.0);
    expect(stats!.top3Rate).toBe(1.0);
  });

  it('counts top3Rate correctly when rank-1 pick places but does not win', async () => {
    // race rA: rank-1 pick finished 2nd (top3 = true, win = false)
    // race rB: rank-1 pick finished 5th (top3 = false, win = false)
    _maeStore['rA'] = {
      raceId: 'rA', raceNumber: 1, analysisDate: '2026-04-01', computedAt: '', meanRankError: 1.0, horseCount: 2,
      horses: [{ horseId: 1, horseName: 'A', predictedRank: 1, actualFinishOrder: 2, rankError: 1 }],
    };
    _maeStore['rB'] = {
      raceId: 'rB', raceNumber: 2, analysisDate: '2026-04-01', computedAt: '', meanRankError: 4.0, horseCount: 2,
      horses: [{ horseId: 1, horseName: 'A', predictedRank: 1, actualFinishOrder: 5, rankError: 4 }],
    };
    const stats = await getAggregateMAEStats();
    expect(stats!.winRate).toBe(0);    // neither won
    expect(stats!.top3Rate).toBe(0.5); // only rA was top-3
  });

  it('mixed: 1 win, 1 top3-but-not-win, 1 miss → winRate 1/3, top3Rate 2/3', async () => {
    _maeStore['r1'] = {
      raceId: 'r1', raceNumber: 1, analysisDate: '2026-04-01', computedAt: '', meanRankError: 0, horseCount: 2,
      horses: [{ horseId: 1, horseName: 'A', predictedRank: 1, actualFinishOrder: 1, rankError: 0 }],
    };
    _maeStore['r2'] = {
      raceId: 'r2', raceNumber: 2, analysisDate: '2026-04-01', computedAt: '', meanRankError: 2, horseCount: 2,
      horses: [{ horseId: 1, horseName: 'A', predictedRank: 1, actualFinishOrder: 3, rankError: 2 }],
    };
    _maeStore['r3'] = {
      raceId: 'r3', raceNumber: 3, analysisDate: '2026-04-01', computedAt: '', meanRankError: 6, horseCount: 2,
      horses: [{ horseId: 1, horseName: 'A', predictedRank: 1, actualFinishOrder: 7, rankError: 6 }],
    };
    const stats = await getAggregateMAEStats();
    expect(stats!.winRate).toBeCloseTo(1 / 3, 5);
    expect(stats!.top3Rate).toBeCloseTo(2 / 3, 5);
  });
});

describe('getAggregateMAEStats metric-definition guard', () => {
  beforeEach(() => {
    for (const k in _maeStore) delete _maeStore[k];
  });

  type Row = import('../v75Cache/types').RaceMAEResult;
  const horse = (eligible: boolean) => ({
    horseId: 1,
    horseName: 'H',
    predictedRank: 1,
    actualFinishOrder: 1,
    rankError: 0,
    ...(eligible ? { eligibleActualRank: 1 } : {}),
  });
  const row = (raceId: string, mae: number, eligible: boolean, horseCount = 8): Row => ({
    raceId, raceNumber: 1, analysisDate: '2026-04-01', computedAt: '',
    meanRankError: mae, horseCount,
    horses: [horse(eligible), horse(eligible)],
  } as Row);

  it('ignores rows computed under the pre-compression definition', async () => {
    _maeStore['legacy'] = row('legacy', 9.0, false);
    _maeStore['current'] = row('current', 1.0, true);
    const stats = await getAggregateMAEStats();
    expect(stats!.raceCount).toBe(1);
    expect(stats!.meanRankError).toBeCloseTo(1.0, 5);
  });

  it('reports how many rows were excluded as legacy', async () => {
    _maeStore['a'] = row('a', 9.0, false);
    _maeStore['b'] = row('b', 8.0, false);
    _maeStore['c'] = row('c', 1.0, true);
    const stats = await getAggregateMAEStats();
    expect(stats!.excludedLegacyRaces).toBe(2);
  });

  it('reports no rank error at all when every stored row predates the definition', async () => {
    _maeStore['a'] = row('a', 9.0, false);
    const stats = await getAggregateMAEStats();
    expect(stats!.meanRankError).toBeNull();
    expect(stats!.raceCount).toBe(0);
    expect(stats!.excludedLegacyRaces).toBe(1);
  });

  it('still counts win/top-3 over legacy rows, whose finish positions stayed comparable', async () => {
    _maeStore['a'] = row('a', 9.0, false);
    _maeStore['b'] = row('b', 1.0, true);
    const stats = await getAggregateMAEStats();
    expect(stats!.hitRateRaceCount).toBe(2);
    expect(stats!.winRate).toBe(1.0);
  });

  it('reports mean evaluated horses per race so shrinking coverage is visible', async () => {
    _maeStore['a'] = row('a', 1.0, true, 10);
    _maeStore['b'] = row('b', 1.0, true, 4);
    const stats = await getAggregateMAEStats();
    expect(stats!.meanHorsesEvaluated).toBeCloseTo(7, 5);
  });
});
