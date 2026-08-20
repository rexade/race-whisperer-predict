// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchRaceById } from '@/services/raceDataCache';
import { V75ResultsFetcher } from '../v75ResultsFetcher';

vi.mock('@/services/raceDataCache', () => ({ fetchRaceById: vi.fn() }));
vi.mock('@/lib/logger', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('V75ResultsFetcher identity contract', () => {
  beforeEach(() => vi.resetAllMocks());

  it('uses program number for fallback identity while preserving the true gate', async () => {
    vi.mocked(fetchRaceById).mockResolvedValue({
      id: 'race-1',
      number: 1,
      status: 'finished',
      starts: [{
        number: 7,
        postPosition: 2,
        horse: { id: 0, name: 'Program Seven' },
        driver: { firstName: 'Test', lastName: 'Driver' },
        result: {
          finalPosition: 1,
          kmTime: { minutes: 1, seconds: 12, tenths: 3 },
        },
      }],
    } as any);

    const [race] = await V75ResultsFetcher.fetchActualResults('2026-08-20', {
      gameId: 'game-1',
      raceIds: ['race-1'],
      startTime: '2026-08-20T18:00:00Z',
      jackpotAmount: 0,
      track: 'Solvalla',
    });

    expect(race.finishOrder[0]).toEqual(expect.objectContaining({
      startNumber: 7,
      postPosition: 2,
      horseKey: 'race-1:start:7',
    }));
  });
});
