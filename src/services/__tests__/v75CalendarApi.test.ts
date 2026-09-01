// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchRaceById } from '@/services/raceDataCache';
import {
  fetchRaceDataForGame,
  fetchV75GameInfo,
  type V75GameInfo,
} from '../v75CalendarApi';

vi.mock('@/services/raceDataCache', () => ({ fetchRaceById: vi.fn() }));

const gameInfo: V75GameInfo = {
  gameId: 'game-1',
  raceIds: ['race-1'],
  startTime: '2024-03-02T15:00:00Z',
  jackpotAmount: 0,
  track: 'Solvalla',
};

const racePayload = (id = 'race-1') => ({
  id,
  number: 1,
  distance: 2140,
  startMethod: 'auto',
  track: { name: 'Solvalla' },
  name: 'Race 1',
  terms: { pools: [{ betType: 'V75', prize: 1000 }] },
  starts: [{
    number: 7,
    postPosition: 2,
    distance: 2140,
    horse: {
      id: 0,
      name: 'Contract Horse',
      statistics: { life: { starts: 10, earnings: 1000 } },
    },
    driver: {
      firstName: 'D',
      lastName: 'River',
      statistics: {
        years: {
          '2023': { winPercentage: 13 },
          '2024': { winPercentage: 24 },
          '2026': { winPercentage: 99 },
        },
      },
    },
    trainer: {
      firstName: 'T',
      lastName: 'Rainer',
      statistics: {
        years: {
          '2023': { winPercentage: 23 },
          '2024': { winPercentage: 34 },
          '2026': { winPercentage: 98 },
        },
      },
    },
  }],
});

describe('v75CalendarApi contracts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, statusText: 'Unavailable' }));
  });

  afterEach(() => vi.unstubAllGlobals());

  it('keeps program number separate from true post position and enriches pools by program number', async () => {
    vi.mocked(fetchRaceById).mockResolvedValue(racePayload());
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        races: [{
          id: 'race-1',
          starts: [{
            number: 7,
            pools: { vinnare: { odds: 866 } },
          }],
        }],
      }),
    } as Response);

    const races = await fetchRaceDataForGame('2024-03-02', gameInfo, 'V75');
    const horse = races[0].horses[0];

    expect(horse.startNumber).toBe(7);
    expect(horse.postPosition).toBe(2);
    expect(horse.horseKey).toBe('race-1:start:7');
    expect(horse.driver.winPercentage2025).toBe(24);
    expect(horse.trainer?.winPercentage2025).toBe(34);
    expect(horse.liveOdds).toBe(8.66);
  });

  it('reads the trainer from the horse, which is where ATG actually nests it', async () => {
    // A trainer belongs to a horse; a driver is booked per start. ATG returns
    // start.horse.trainer and never start.trainer, so reading the start-level
    // path left trainerPerformance -- one of the largest weights -- silently
    // contributing zero on every real race. The fixture below is the live shape.
    const payload = racePayload();
    delete (payload.starts[0] as Record<string, unknown>).trainer;
    (payload.starts[0].horse as Record<string, unknown>).trainer = {
      firstName: 'Daniel',
      lastName: 'Wäjersten',
      statistics: { years: { '2023': { winPercentage: 1900 }, '2024': { winPercentage: 2230 } } },
    };
    vi.mocked(fetchRaceById).mockResolvedValue(payload);

    const races = await fetchRaceDataForGame('2024-03-02', gameInfo, 'V75');
    const horse = races[0].horses[0];

    expect(horse.trainer?.lastName).toBe('Wäjersten');
    expect(horse.trainer?.winPercentage2025).toBe(2230);
  });

  it('preserves legitimate zero-valued career statistics', async () => {
    const payload = racePayload();
    Object.assign(payload.starts[0].horse.statistics.life, {
      startPoints: 0,
      placePercentage: 0,
      winPercentage: 0,
      earnings: 0,
    });
    vi.mocked(fetchRaceById).mockResolvedValue(payload);

    const races = await fetchRaceDataForGame('2024-03-02', gameInfo, 'V75');

    expect(races[0].horses[0].statistics).toEqual({
      startPoints: 0,
      placePercentage: 0,
      winPercentage: 0,
      earningsPerStart: 0,
    });
  });

  it('rejects an incomplete race card instead of returning fulfilled races', async () => {
    const incompleteInfo = { ...gameInfo, raceIds: ['race-1', 'race-2'] };
    vi.mocked(fetchRaceById)
      .mockResolvedValueOnce(racePayload('race-1'))
      .mockRejectedValueOnce(new Error('race-2 failed'));

    await expect(fetchRaceDataForGame('2024-03-02', incompleteInfo, 'V75'))
      .rejects.toThrow('Incomplete V75 race card');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects a fulfilled race payload with no starts', async () => {
    vi.mocked(fetchRaceById).mockResolvedValue({
      ...racePayload(),
      starts: [],
    });

    await expect(fetchRaceDataForGame('2024-03-02', gameInfo, 'V75'))
      .rejects.toThrow('Incomplete V75 race card');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects operational calendar failures but returns null for a genuine no-game day', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, statusText: 'Bad Gateway' } as Response);
    await expect(fetchV75GameInfo('2026-08-22', 'V75')).rejects.toThrow('Bad Gateway');

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ games: {} }),
    } as Response);
    await expect(fetchV75GameInfo('2026-08-23', 'V75')).resolves.toBeNull();
  });
});
