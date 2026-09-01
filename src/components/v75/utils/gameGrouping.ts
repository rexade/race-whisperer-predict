import { GAME_TYPE_LABELS, SUPPORTED_GAME_TYPES, type GameType } from '@/config/game';
import type { DayGame } from '@/services/v75CalendarApi';

export interface GameGroup {
  gameType: GameType;
  label: string;
  games: DayGame[];
}

const byStartTime = (a: DayGame, b: DayGame) => a.startTime.localeCompare(b.startTime);

/**
 * Collapse a race day into one row per bet type, biggest pool first.
 *
 * A day carries up to eleven V4 games and ninety single races; listing them
 * flat buries the V85 nobody wants to scroll past. Groups with a single game
 * are still groups — the picker selects those without expanding.
 */
export const groupGamesByType = (games: DayGame[]): GameGroup[] =>
  SUPPORTED_GAME_TYPES
    .map(gameType => ({
      gameType,
      label: GAME_TYPE_LABELS[gameType],
      games: games.filter(game => game.gameType === gameType).sort(byStartTime),
    }))
    .filter(group => group.games.length > 0);

/**
 * Race number from an ATG race id (`2026-09-05_7_12` → 12). Under a track
 * heading the number is the only thing telling one enloppsspel row from another.
 */
export const raceNumberFromId = (raceId: string): number | null => {
  const match = /_(\d+)$/.exec(raceId);
  return match ? Number(match[1]) : null;
};

/**
 * Sub-group a type's games by track — used for enloppsspel, where the games are
 * individual races and the track is the only thing that makes them navigable.
 */
export const groupGamesByTrack = (games: DayGame[]): Array<{ track: string; games: DayGame[] }> => {
  const byTrack = new Map<string, DayGame[]>();
  for (const game of [...games].sort(byStartTime)) {
    const existing = byTrack.get(game.track);
    if (existing) existing.push(game);
    else byTrack.set(game.track, [game]);
  }
  return [...byTrack.entries()]
    .map(([track, trackGames]) => ({ track, games: trackGames }))
    .sort((a, b) => a.games[0].startTime.localeCompare(b.games[0].startTime));
};
