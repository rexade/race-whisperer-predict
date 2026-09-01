import React, { useState } from 'react';
import { ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DayGame } from '@/services/v75CalendarApi';
import type { GameType } from '@/config/game';
import { groupGamesByTrack, groupGamesByType, raceNumberFromId } from './utils/gameGrouping';

interface GamePickerProps {
  games: DayGame[];
  selectedGameId?: string;
  onSelect: (game: DayGame) => void;
  loading?: boolean;
}

const startTimeOf = (game: DayGame) => game.startTime.slice(11, 16);

const raceCountLabel = (game: DayGame) =>
  game.raceCount === 1 ? '1 lopp' : `${game.raceCount} lopp`;

/**
 * A single game: track, post time, race count. The row is the click target for
 * both a whole card (V85 at Jägersro) and one race (enloppsspel).
 */
const GameRow: React.FC<{
  game: DayGame;
  selected: boolean;
  onSelect: (game: DayGame) => void;
  /** Overrides the track name — under a track heading it would just repeat. */
  primary?: string;
}> = ({ game, selected, onSelect, primary }) => (
  <button
    onClick={() => onSelect(game)}
    className={cn(
      'w-full flex items-center justify-between gap-3 h-11 px-3 rounded-md text-sm transition-colors text-left',
      selected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
    )}
  >
    <span className="truncate font-medium">{primary ?? game.track}</span>
    <span
      className={cn(
        'num text-xs whitespace-nowrap',
        selected ? 'text-primary-foreground/80' : 'text-muted-foreground'
      )}
    >
      {startTimeOf(game)} · {raceCountLabel(game)}
    </span>
  </button>
);

/**
 * Date-first game selection: everything trotting on the chosen date, collapsed
 * to one row per bet type. Types running at a single track select on click;
 * the rest expand to a track list. Enloppsspel expands to tracks first, because
 * a race day carries around ninety individual races.
 */
const GamePicker: React.FC<GamePickerProps> = ({ games, selectedGameId, onSelect, loading }) => {
  const [expandedType, setExpandedType] = useState<GameType | null>(null);
  const groups = groupGamesByType(games);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 justify-center text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Hämtar dagens spel…
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Inga travlopp den här dagen.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {groups.map(group => {
        const single = group.games.length === 1;
        const expanded = expandedType === group.gameType;
        const holdsSelection = group.games.some(game => game.gameId === selectedGameId);

        return (
          <div key={group.gameType}>
            <button
              onClick={() =>
                single
                  ? onSelect(group.games[0])
                  : setExpandedType(expanded ? null : group.gameType)
              }
              className={cn(
                'w-full flex items-center justify-between gap-3 h-11 px-3 rounded-md text-sm font-bold transition-colors text-left',
                holdsSelection && !expanded ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              )}
            >
              <span className="truncate">{group.label}</span>
              <span
                className={cn(
                  'flex items-center gap-1.5 num text-xs whitespace-nowrap font-medium',
                  holdsSelection && !expanded ? 'text-primary-foreground/80' : 'text-muted-foreground'
                )}
              >
                {single
                  ? `${group.games[0].track} · ${startTimeOf(group.games[0])}`
                  : `${group.games.length} spel`}
                {!single && (
                  <ChevronRight
                    className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-90')}
                  />
                )}
              </span>
            </button>

            {!single && expanded && (
              <div className="pl-3 border-l-2 border-border ml-3 mt-0.5 space-y-0.5">
                {group.gameType === 'vinnare'
                  ? groupGamesByTrack(group.games).map(({ track, games: trackGames }) => (
                      <div key={track}>
                        <div className="eyebrow px-3 pt-2 pb-1">{track}</div>
                        {trackGames.map(game => {
                          const raceNumber = raceNumberFromId(game.raceIds[0] ?? '');
                          return (
                            <GameRow
                              key={game.gameId}
                              game={game}
                              primary={raceNumber ? `Lopp ${raceNumber}` : game.track}
                              selected={game.gameId === selectedGameId}
                              onSelect={onSelect}
                            />
                          );
                        })}
                      </div>
                    ))
                  : group.games.map(game => (
                      <GameRow
                        key={game.gameId}
                        game={game}
                        selected={game.gameId === selectedGameId}
                        onSelect={onSelect}
                      />
                    ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default GamePicker;
