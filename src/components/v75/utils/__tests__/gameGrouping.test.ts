import { describe, expect, it } from 'vitest';
import type { DayGame } from '@/services/v75CalendarApi';
import type { GameType } from '@/config/game';
import { groupGamesByTrack, groupGamesByType, raceNumberFromId } from '../gameGrouping';

const game = (gameType: GameType, track: string, startTime: string, raceCount = 4): DayGame => ({
  gameId: `${gameType}_${track}_${startTime}`,
  gameType,
  raceIds: Array.from({ length: raceCount }, (_, i) => `race-${i}`),
  raceCount,
  startTime,
  jackpotAmount: 0,
  track,
  trackId: 1,
});

describe('groupGamesByType', () => {
  it('orders groups by pool size, biggest first', () => {
    const groups = groupGamesByType([
      game('vinnare', 'Jägersro', '2026-09-05T13:30:00', 1),
      game('V4', 'Årjäng', '2026-09-05T12:37:00'),
      game('V85', 'Jägersro', '2026-09-05T15:00:00', 8),
    ]);

    expect(groups.map(g => g.gameType)).toEqual(['V85', 'V4', 'vinnare']);
  });

  it('keeps every game of a type that runs at several tracks', () => {
    const groups = groupGamesByType([
      game('V4', 'Årjäng', '2026-09-05T12:37:00'),
      game('V4', 'Jägersro', '2026-09-05T13:30:00'),
      game('V4', 'Bergen', '2026-09-05T18:10:00'),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].games.map(g => g.track)).toEqual(['Årjäng', 'Jägersro', 'Bergen']);
  });

  it('labels ATG lowercase bet types with the names players use', () => {
    const groups = groupGamesByType([
      game('dd', 'Jägersro', '2026-09-05T17:13:00', 2),
      game('vinnare', 'Jägersro', '2026-09-05T13:30:00', 1),
    ]);

    expect(groups.map(g => g.label)).toEqual(['Dagens Dubbel', 'Enloppsspel']);
  });

  it('omits game types that are not running that day', () => {
    const groups = groupGamesByType([game('V65', 'Bergen', '2026-09-05T18:10:00', 6)]);

    expect(groups.map(g => g.gameType)).toEqual(['V65']);
  });

  it('orders the games inside a group by start time', () => {
    const groups = groupGamesByType([
      game('V5', 'Bergen', '2026-09-05T18:10:00', 5),
      game('V5', 'Jägersro', '2026-09-05T13:30:00', 5),
    ]);

    expect(groups[0].games.map(g => g.startTime))
      .toEqual(['2026-09-05T13:30:00', '2026-09-05T18:10:00']);
  });
});

describe('groupGamesByTrack', () => {
  it('collects a track’s races together so ~90 single races stay navigable', () => {
    const tracks = groupGamesByTrack([
      game('vinnare', 'Jägersro', '2026-09-05T13:30:00', 1),
      game('vinnare', 'Årjäng', '2026-09-05T12:37:00', 1),
      game('vinnare', 'Jägersro', '2026-09-05T13:52:00', 1),
    ]);

    expect(tracks.map(t => t.track)).toEqual(['Årjäng', 'Jägersro']);
    expect(tracks[1].games).toHaveLength(2);
  });
});

describe('raceNumberFromId', () => {
  it('reads the race number off an ATG race id', () => {
    // Ids are date_track_number, so the number is the last segment -- the only
    // thing that distinguishes one enloppsspel row from the next at a track.
    expect(raceNumberFromId('2026-09-05_7_1')).toBe(1);
    expect(raceNumberFromId('2026-09-05_7_12')).toBe(12);
  });

  it('returns null when the id does not end in a race number', () => {
    expect(raceNumberFromId('V85_2026-09-05_7_5_x')).toBeNull();
    expect(raceNumberFromId('')).toBeNull();
  });
});
