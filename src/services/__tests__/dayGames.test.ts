// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchGamesForDate } from '../v75CalendarApi';

/**
 * Shaped after the live /calendar/day/{date} payload: games are keyed by ATG's
 * bet type, several types run many games a day (one per track), race ids are
 * bare, and track names + sport live in a separate top-level `tracks` array.
 */
const dayPayload = () => ({
  games: {
    V85: [{
      id: 'V85_2026-09-05_7_5',
      startTime: '2026-09-05T15:00:00',
      tracks: [7],
      races: ['2026-09-05_7_5', '2026-09-05_7_6', '2026-09-05_7_7', '2026-09-05_7_8'],
    }],
    V4: [
      {
        id: 'V4_2026-09-05_7_1',
        startTime: '2026-09-05T13:30:00',
        tracks: [7],
        races: ['2026-09-05_7_1', '2026-09-05_7_2', '2026-09-05_7_3', '2026-09-05_7_4'],
      },
      {
        id: 'V4_2026-09-05_31_2',
        startTime: '2026-09-05T12:37:00',
        tracks: [31],
        races: ['2026-09-05_31_2', '2026-09-05_31_3', '2026-09-05_31_4', '2026-09-05_31_5'],
      },
      {
        id: 'V4_2026-09-05_56_1',
        startTime: '2026-09-05T14:30:00',
        tracks: [56],
        races: ['2026-09-05_56_1', '2026-09-05_56_2', '2026-09-05_56_3', '2026-09-05_56_4'],
      },
    ],
    dd: [{
      id: 'dd_2026-09-05_7_11',
      startTime: '2026-09-05T17:13:00',
      tracks: [7],
      races: ['2026-09-05_7_11', '2026-09-05_7_12'],
    }],
    vinnare: [{
      id: 'vinnare_2026-09-05_7_1',
      startTime: '2026-09-05T13:30:00',
      tracks: [7],
      races: ['2026-09-05_7_1'],
    }],
    // Same races as `vinnare`, different bet type — listing these would show the
    // identical race five times over.
    plats: [{ id: 'plats_2026-09-05_7_1', startTime: '2026-09-05T13:30:00', tracks: [7], races: ['2026-09-05_7_1'] }],
    trio: [{ id: 'trio_2026-09-05_7_1', startTime: '2026-09-05T13:30:00', tracks: [7], races: ['2026-09-05_7_1'] }],
    komb: [{ id: 'komb_2026-09-05_7_1', startTime: '2026-09-05T13:30:00', tracks: [7], races: ['2026-09-05_7_1'] }],
    top7: [{ id: 'top7_2026-09-05_7_9', startTime: '2026-09-05T16:28:00', tracks: [7], races: ['2026-09-05_7_9'] }],
  },
  tracks: [
    { id: 7, name: 'Jägersro', sport: 'trot', countryCode: 'SE' },
    { id: 31, name: 'Årjäng', sport: 'trot', countryCode: 'SE' },
    { id: 56, name: 'Klampenborg', sport: 'gallop', countryCode: 'DK' },
  ],
});

const respondWith = (payload: unknown) =>
  vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => payload } as Response);

describe('fetchGamesForDate', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => vi.unstubAllGlobals());

  it('returns every game of a type, not just the first', async () => {
    // V4 runs at up to eleven tracks a day. Taking games.V4[0] analyzes one
    // arbitrary track and silently discards the rest.
    respondWith(dayPayload());

    const games = await fetchGamesForDate('2026-09-05');
    const v4 = games.filter(g => g.gameType === 'V4');

    expect(v4.map(g => g.track)).toEqual(['Årjäng', 'Jägersro']);
  });

  it('resolves the track name and race count for each game', async () => {
    respondWith(dayPayload());

    const games = await fetchGamesForDate('2026-09-05');

    expect(games.find(g => g.gameType === 'V85')).toMatchObject({
      gameId: 'V85_2026-09-05_7_5',
      gameType: 'V85',
      track: 'Jägersro',
      trackId: 7,
      raceCount: 4,
      startTime: '2026-09-05T15:00:00',
    });
  });

  it('excludes gallop games, which the km-time model cannot score', async () => {
    respondWith(dayPayload());

    const games = await fetchGamesForDate('2026-09-05');

    expect(games.map(g => g.track)).not.toContain('Klampenborg');
  });

  it('excludes bet types that duplicate races already listed as enloppsspel', async () => {
    respondWith(dayPayload());

    const games = await fetchGamesForDate('2026-09-05');

    expect([...new Set(games.map(g => g.gameType))].sort())
      .toEqual(['V4', 'V85', 'dd', 'vinnare']);
  });

  it('orders games by start time', async () => {
    respondWith(dayPayload());

    const games = await fetchGamesForDate('2026-09-05');

    expect(games.map(g => g.startTime)).toEqual([...games.map(g => g.startTime)].sort());
  });

  it('drops a game whose track is missing from the day payload', async () => {
    // Without a track entry there is no sport to check, so the game could be a
    // gallop card in disguise — and it would render as an unlabelled row.
    const payload = dayPayload();
    payload.games.V85[0].tracks = [999];
    respondWith(payload);

    const games = await fetchGamesForDate('2026-09-05');

    expect(games.some(g => g.gameType === 'V85')).toBe(false);
  });

  it('raises calendar failures instead of reporting an empty race day', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, statusText: 'Bad Gateway' } as Response);

    await expect(fetchGamesForDate('2026-09-05')).rejects.toThrow('Bad Gateway');
  });
});
