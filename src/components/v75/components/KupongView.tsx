import React from 'react';
import { V75RaceResult } from '../hooks/useV75Analysis';
import { sortByPrediction, spreadSuggestion, LegConfidence } from '../utils/raceRanking';

interface KupongViewProps {
  races: V75RaceResult[];
  /** Jump to a race tab (same handler as the race strip). */
  onSelectRace: (tab: string) => void;
}

const CONFIDENCE_LABEL: Record<LegConfidence, string> = {
  spik: 'SPIK ★',
  favorit: 'FAVORIT',
  oppet: 'GARDERA',
};

const CONFIDENCE_CLASS: Record<LegConfidence, string> = {
  spik: 'text-success',
  favorit: 'text-warning',
  oppet: 'text-primary',
};

/**
 * Kupong view — the whole ticket on one screen.
 * Each leg: top pick + suggested coverage from predicted-time margins.
 */
const KupongView: React.FC<KupongViewProps> = ({ races, onSelectRace }) => {
  const legs = races
    .filter(r => r.analysisComplete && r.horses.length > 0)
    .map(race => {
      const sorted = sortByPrediction(race.horses);
      const spread = spreadSuggestion(sorted);
      return { race, sorted, spread };
    })
    .filter(l => l.sorted.length > 0);

  if (legs.length === 0) return null;

  return (
    <div className="mx-1 sm:mx-0 mb-4 rounded-xl border-[1.5px] border-foreground/70 bg-card overflow-hidden">
      <div className="flex items-baseline justify-between px-3 py-2 border-b-2 border-foreground/70">
        <span className="font-display italic font-bold text-base">Kupongförslag</span>
        <span className="eyebrow num">{legs.length} lopp</span>
      </div>
      <div>
        {legs.map(({ race, spread }, i) => {
          const top = spread.horses[0];
          const rest = spread.horses.slice(1);
          return (
            <button
              key={race.raceNumber}
              onClick={() => onSelectRace(`race-${race.raceNumber}`)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 min-h-[48px] text-left hover:bg-muted/40 transition-colors ${i < legs.length - 1 ? 'border-b border-border/70' : ''}`}
            >
              <span className="font-display font-bold text-lg text-muted-foreground w-6 text-center num shrink-0">
                {race.raceNumber}
              </span>
              <span className="flex-1 min-w-0 text-sm">
                <span className="num font-bold">{top?.postPosition}</span>{' '}
                <span className="font-display font-semibold truncate">{top?.horseName}</span>
                {rest.length > 0 && (
                  <span className="text-muted-foreground num text-xs">
                    {' '}+ {rest.map(h => h.postPosition).join(', ')}
                  </span>
                )}
              </span>
              <span className={`text-[10px] uppercase tracking-[0.16em] font-bold shrink-0 ${CONFIDENCE_CLASS[spread.type]}`}>
                {CONFIDENCE_LABEL[spread.type]}{spread.type !== 'spik' ? ` ${spread.horses.length}` : ''}
              </span>
            </button>
          );
        })}
      </div>
      <div className="px-3 py-1.5 bg-muted/40 eyebrow">
        Modellens spelförslag — tryck på ett lopp för detaljer
      </div>
    </div>
  );
};

export default KupongView;
