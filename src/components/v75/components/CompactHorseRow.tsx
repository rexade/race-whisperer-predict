import React, { useState } from 'react';
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronDown, Zap, Banknote, Award, AlertTriangle, Clock, BarChart2, WifiOff } from "lucide-react";
import { V75HorseResult } from '../hooks/useV75Analysis';
import { ensureStringForDisplay, formatKmTime, formatEarnings, getShoesDisplay, getShoesColor, getSulkyDisplay } from '../utils/v75DisplayUtils';
import { getLatestKmTimeDisplay } from '../../../services/kmTimeRecords';
import { hasAnyFlag, computeReliabilityScore, type HorseConfidenceFlags } from '../utils/confidenceFlags';
import { horseResultDomId } from '../utils/horseResultIdentity';
import { fieldStrength, rankingScoreSeconds } from '../utils/raceRanking';

interface CompactHorseRowProps {
  horse: V75HorseResult;
  rank: number;
  /** Every horse's ranking score in this race, so the bar scales within the leg. */
  fieldSeconds: number[];
  /** Predicted-time gap to the next-ranked horse (seconds) — winner card confidence bar. */
  marginToNext?: number;
  /** Model ranks this horse well above its betting support — highlight as value. */
  isValuePick?: boolean;
}

const uncertainLabel: Record<string, string> = {
  best_only: "Best raw time used — no valid normalized samples available",
  no_valid_samples: "Fallback estimate — no valid historical samples found",
};

// Small tooltip-wrapped chip used for per-horse confidence flags
const FlagChip: React.FC<{
  icon: React.ReactNode;
  label: string;
  tooltip: string;
  variant?: 'warn' | 'danger' | 'muted';
}> = ({ icon, label, tooltip, variant = 'muted' }) => {
  const colorClass =
    variant === 'danger' ? 'text-destructive border-destructive/30 bg-destructive/5'
    : variant === 'warn' ? 'text-warning border-warning/30 bg-warning/5'
    : 'text-muted-foreground border-border bg-muted/30';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline-flex items-center gap-0.5 text-[10px] px-1 py-0 rounded border cursor-default ${colorClass}`}
          aria-label={tooltip}
        >
          {icon}
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
};

const ConfidenceFlagStrip: React.FC<{ flags: HorseConfidenceFlags }> = ({ flags }) => {
  if (!hasAnyFlag(flags)) return null;
  return (
    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
      {flags.noKmTime && (
        <FlagChip
          icon={<WifiOff className="h-2.5 w-2.5" aria-hidden="true" />}
          label="No KM"
          tooltip="No km time — score is a fallback estimate"
          variant="danger"
        />
      )}
      {flags.lowSampleSize && (
        <FlagChip
          icon={<BarChart2 className="h-2.5 w-2.5" aria-hidden="true" />}
          label={`Thin (${flags.validTimesCount})`}
          tooltip={`Only ${flags.validTimesCount} valid km-time sample(s) — thin data basis`}
          variant="muted"
        />
      )}
      {flags.gallopRisk && (
        <FlagChip
          icon={<AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" />}
          label={`Gallop ×${flags.gallopCount}`}
          tooltip={`${flags.gallopCount} gallop(s) in last 10 starts — reliability concern`}
          variant="warn"
        />
      )}
      {flags.staleForm && (
        <FlagChip
          icon={<Clock className="h-2.5 w-2.5" aria-hidden="true" />}
          label="Stale"
          tooltip="Most recent race was 90+ days ago — form data may be stale"
          variant="warn"
        />
      )}
      {flags.noDriverStats && (
        <FlagChip
          icon={<WifiOff className="h-2.5 w-2.5" aria-hidden="true" />}
          label="No drv"
          tooltip="Driver 2025 win% unavailable — driver factor defaulted"
          variant="muted"
        />
      )}
    </div>
  );
};

// ── Reliability dot (1-5 score derived from existing pipeline fields) ──────────

const RELIABILITY_DOT_COLOR: Record<number, string> = {
  5: 'text-success',
  4: 'text-success',
  3: 'text-warning',
  2: 'text-destructive',
  1: 'text-destructive',
};

function buildReliabilityTooltip(score: number, horse: V75HorseResult): string {
  const deductions: string[] = [];
  if (horse.timeSource === 'none') deductions.push('no usable time');
  else if (horse.uncertain) deductions.push('using raw best-time fallback');
  if (horse.historySource === 'abroad') deductions.push('foreign-track data');
  if (horse.confidenceMultiplier !== undefined && horse.confidenceMultiplier < 0.5) {
    deductions.push('very thin raw data');
  }
  if (horse.confidenceFlags?.gallopRisk) deductions.push(`gallop risk ×${horse.confidenceFlags.gallopCount}`);
  if (horse.confidenceFlags?.staleForm) deductions.push('stale form (90+ days)');
  if (horse.confidenceFlags?.lowSampleSize) deductions.push(`thin sample (${horse.confidenceFlags.validTimesCount} times)`);
  if (horse.confidenceFlags?.noDriverStats) deductions.push('no driver stats');
  return deductions.length
    ? `Signal ${score}/5 — ${deductions.join(', ')}`
    : `Signal ${score}/5 — strong data basis`;
}

const ReliabilityDot: React.FC<{ score: number; tooltip: string }> = ({ score, tooltip }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <span
        className={`${RELIABILITY_DOT_COLOR[score] ?? 'text-muted-foreground'} text-[9px] cursor-default leading-none`}
        aria-label={tooltip}
      >
        ●
      </span>
    </TooltipTrigger>
    <TooltipContent>{tooltip}</TooltipContent>
  </Tooltip>
);

// ──────────────────────────────────────────────────────────────────────────────

const CompactHorseRow: React.FC<CompactHorseRowProps> = ({ horse, rank, fieldSeconds, marginToNext, isValuePick }) => {
  // Collapsed by default. A handicap field runs to thirteen horses; showing every
  // form signal for all of them puts about three on a phone screen.
  const [expanded, setExpanded] = useState(false);
  const result = horse.modernNormalizedResult!;
  const isTopPerformer = rank <= 3;
  const isWinnerPick = rank === 1;
  const safeHorseName = ensureStringForDisplay(horse.horseName);
  const safeDriverName = ensureStringForDisplay(horse.driverName);
  // Falls back to postPosition only when startNumber is genuinely absent; the two
  // are equal in ordinary races and diverge in handicaps, where postPosition
  // restarts per tillägg tier and is not the number on the card.
  const programNumber = horse.startNumber ?? horse.postPosition;
  const latestKmTime = horse.kmTimeRecords?.length ? getLatestKmTimeDisplay(horse.kmTimeRecords) : null;
  const breakdownId = horseResultDomId(horse);
  const strength = fieldStrength(rankingScoreSeconds(horse), fieldSeconds);

  // Barefoot ("barfota") is the fast setup; the change flag means it's new for this start
  const isBarefoot = horse.shoesFront === false || horse.shoesBack === false;
  const shoesChangedToday = Boolean(horse.shoesFrontChanged || horse.shoesBackChanged);

  // Winner confidence: margin to rank 2, normalized against a 2 s "dominant" gap
  const marginPct = marginToNext !== undefined ? Math.min(marginToNext / 2, 1) * 100 : undefined;
  const marginLabel = marginToNext !== undefined ? marginToNext.toFixed(1).replace('.', ',') : undefined;

  const getRowStyle = (rank: number) => {
    if (rank === 1) return "bg-card border-[1.5px] border-foreground/80 dark:border-primary rounded-xl mx-1 sm:mx-0 shadow-sm";
    return "bg-transparent hover:bg-muted/30 border-b border-border/70 last:border-b-0";
  };

  const confidenceColor =
    horse.confidence === undefined ? ''
    : horse.confidence >= 80 ? 'text-success'
    : horse.confidence >= 50 ? 'text-warning'
    : 'text-destructive';

  const flags = horse.confidenceFlags;

  const winPercentage = horse.statistics?.winPercentage ?? 0;
  const driverWinPercentage = horse.driver2025WinPercentage ?? 0;
  const startPoints = horse.statistics?.startPoints ?? 0;
  const earningsPerStart = horse.statistics?.earningsPerStart ?? 0;

  const relScore = computeReliabilityScore(
    horse.confidenceFlags,
    horse.timeSource,
    horse.uncertain,
    horse.historySource,
    horse.confidenceMultiplier,
  );
  const relTooltip = buildReliabilityTooltip(relScore, horse);

  return (
    <div
      className={`${getRowStyle(rank)} p-2 sm:p-3 min-h-[44px] transition-all duration-200 cursor-pointer`}
      onClick={() => setExpanded(!expanded)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(!expanded); } }}
      role="button"
      tabIndex={0}
      // Without this the name is computed from the whole subtree, and a screen
      // reader reads out every chip, time and percentage before saying "button".
      aria-label={`${programNumber} ${safeHorseName}`}
      aria-expanded={expanded}
      aria-controls={breakdownId}
    >
      {/* Main content - always visible */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Programme number above, rank below. The programme number is what
            identifies the horse on the ATG card and on a ticket, so it is the
            prominent numeral; rank is already implied by the row's position in
            a rank-sorted list. Post position moves to the meta line, because in
            a handicap race it restarts at each tillägg tier -- three horses can
            all be "Spår 1" -- and standing alone beside a horse it reads as a
            programme number that does not match the card. */}
        <div className="flex flex-col items-center w-[44px] flex-shrink-0">
          <div
            className={`font-display leading-none ${
              isWinnerPick
                ? 'text-[26px] font-bold text-primary'
                : isTopPerformer
                  ? 'text-xl font-semibold text-foreground/80'
                  : 'text-xl text-muted-foreground'
            }`}
            aria-label={`Programme number ${programNumber}`}
          >
            {programNumber}
          </div>
          <div className="eyebrow num mt-0.5" aria-label={`Rank ${rank}`}>
            Rank {rank}
          </div>
        </div>

        {/* Horse Info - Primary column */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <div className={`font-display leading-tight truncate ${isWinnerPick ? 'font-bold text-base' : 'font-semibold text-[15px]'}`}>{safeHorseName}</div>
                {/* Value pick: model ranks this horse well above its betting support */}
                {isValuePick && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/15 text-success font-bold whitespace-nowrap cursor-default">
                        VÄRDE
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      The model ranks this horse well above its betting support ({horse.betDistribution?.toFixed(1)}% of bets) — a potential value play
                    </TooltipContent>
                  </Tooltip>
                )}
                {/* History source badge */}
                {horse.historySource === "local" && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary whitespace-nowrap">Local</span>
                )}
                {horse.historySource === "abroad" && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground whitespace-nowrap">Abroad</span>
                )}
                {horse.historySource === "none" && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground whitespace-nowrap">No data</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <div className="text-xs text-muted-foreground leading-tight truncate">{safeDriverName}</div>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">Spår {horse.postPosition}</span>
                {/* Barfota — the fast setup; "idag" when switched for this start */}
                {isBarefoot && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/10 text-success font-semibold whitespace-nowrap cursor-default">
                        barfota{shoesChangedToday ? ' idag' : ''} ✓
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {shoesChangedToday
                        ? 'Shoes pulled for this start — a go-fast signal'
                        : 'Races barefoot (front and/or back)'}
                    </TooltipContent>
                  </Tooltip>
                )}
                {/* Confidence indicator */}
                {horse.confidence !== undefined && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 cursor-default"
                        aria-label={`Data confidence: ${horse.confidence}%`}
                      >
                        <span className={confidenceColor} aria-hidden="true">●</span>
                        <span className="text-muted-foreground tabular-nums">{horse.confidence}%</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      Data confidence: {horse.confidence}%
                      {horse.confidence < 50 && ' — limited historical data'}
                      {horse.confidence >= 50 && horse.confidence < 80 && ' — moderate data coverage'}
                      {horse.confidence >= 80 && ' — strong data coverage'}
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              {/* Per-horse confidence flags — only rendered when at least one flag is raised */}
              {flags && <ConfidenceFlagStrip flags={flags} />}
            </div>
          </div>
        </div>

        {/* Times — Pred most prominent, Raw + Best secondary */}
        <div className="flex flex-col gap-1 min-w-0">
          {/* Predicted Time */}
          <div className="text-center">
            <div className={`num text-base sm:text-lg font-bold ${isTopPerformer ? 'text-primary' : 'text-foreground'} flex items-center justify-center gap-1`}>
              {horse.uncertain && (
                <span className="text-warning" aria-hidden="true">≈</span>
              )}
              {formatKmTime(result.modernNormalizedTime)}
              {horse.uncertain && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="text-[9px] px-1 py-0.5 rounded bg-warning/10 text-warning border border-warning/20 whitespace-nowrap cursor-default"
                      aria-label={uncertainLabel[horse.uncertaintyReason ?? ''] ?? 'Approximation'}
                    >
                      uncertain
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {uncertainLabel[horse.uncertaintyReason ?? ''] ?? 'Approximation'}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <div className="text-xs text-primary font-medium flex items-center justify-center gap-0.5">
              Pred
              <ReliabilityDot score={relScore} tooltip={relTooltip} />
            </div>
          </div>

          {/* Raw and Best */}
          <div className="flex gap-2 justify-center">
            <div className="text-center">
              <div className="num text-xs font-medium text-muted-foreground">
                {horse.rawKmTime ? formatKmTime(horse.rawKmTime) : '—'}
              </div>
              <div className="text-xs text-muted-foreground">Raw</div>
            </div>
            <div className="text-center">
              <div className="num text-xs font-medium text-muted-foreground">
                {horse.bestRecordTime ? formatKmTime(horse.bestRecordTime) : '—'}
              </div>
              <div className="text-xs text-muted-foreground">Best</div>
            </div>
          </div>

          {/* Market line — the numbers a bettor cross-checks against */}
          {(horse.liveOdds !== undefined || horse.betDistribution !== undefined) && (
            <div className="num text-[11px] text-muted-foreground text-center whitespace-nowrap">
              {horse.liveOdds !== undefined && <>odds <span className="font-semibold text-foreground/80">{horse.liveOdds.toFixed(2)}</span></>}
              {horse.liveOdds !== undefined && horse.betDistribution !== undefined && ' · '}
              {horse.betDistribution !== undefined && <>spel <span className="font-semibold text-foreground/80">{horse.betDistribution.toFixed(0)}%</span></>}
            </div>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 flex-shrink-0 text-muted-foreground/60 transition-transform ${expanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </div>

      {/* Predicted time as a bar, scaled within this race. Lets the shape of a
          leg be read without parsing thirteen km-times — a near-full bar with a
          visible drop behind it is a spik at a glance. */}
      <div className="h-[3px] rounded-sm bg-muted overflow-hidden mt-1.5" aria-hidden="true">
        <div className="h-full bg-primary transition-all" style={{ width: `${strength * 100}%` }} />
      </div>

      {/* Form detail — one tap away. Collapsed, the row carries number, name,
          predicted time, market and the strength bar; that is what a field is
          scanned on. */}
      {expanded && (
        <div id={breakdownId} className="mt-1 sm:mt-2 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs flex-wrap">
              {/* Horse win % */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 cursor-default" aria-label={`Horse win rate: ${winPercentage ? (winPercentage / 100).toFixed(0) : 0}%`}>
                    <span className={`font-medium tabular-nums ${winPercentage > 0 ? 'text-success' : 'text-muted-foreground'}`}>
                      {winPercentage ? (winPercentage / 100).toFixed(0) + '%' : '—'}
                    </span>
                    <span className="text-muted-foreground">win</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>Horse win rate (career)</TooltipContent>
              </Tooltip>

              {/* Driver win % */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 cursor-default" aria-label={`Driver win rate: ${driverWinPercentage ? (driverWinPercentage / 100).toFixed(0) : 0}%`}>
                    <Zap className="h-3 w-3 text-success" aria-hidden="true" />
                    <span className={`font-medium tabular-nums ${driverWinPercentage > 0 ? 'text-success' : 'text-muted-foreground'}`}>
                      {driverWinPercentage ? (driverWinPercentage / 100).toFixed(0) + '%' : '—'}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>Driver win rate (2025)</TooltipContent>
              </Tooltip>

              {/* Start Points */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 cursor-default" aria-label={`Start points: ${startPoints || '—'}`}>
                    <Award className="h-3 w-3 text-primary" aria-hidden="true" />
                    <span className={`font-medium tabular-nums ${startPoints > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                      {startPoints ? startPoints : '—'}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>Start points (form rating)</TooltipContent>
              </Tooltip>

              {/* Earnings per start */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 cursor-default" aria-label={`Earnings per start: ${earningsPerStart > 0 ? formatEarnings(earningsPerStart) : '—'}`}>
                    <Banknote className="h-3 w-3 text-warning" aria-hidden="true" />
                    <span className={`font-medium tabular-nums ${earningsPerStart > 0 ? 'text-warning' : 'text-muted-foreground'}`}>
                      {earningsPerStart > 0 ? formatEarnings(earningsPerStart) : '—'}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>Earnings per start (class indicator)</TooltipContent>
              </Tooltip>

              {/* Home Track — only if different from race track */}
              {horse.homeTrack && horse.homeTrack !== horse.track && (
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground" aria-hidden="true">@</span>
                  <span className="font-medium text-accent">{horse.homeTrack}</span>
                </div>
              )}

              {/* Equipment */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="text-xs h-4 px-1 cursor-default">
                    {getSulkyDisplay(horse.sulkyType)}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Sulky type</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={`font-medium text-xs cursor-default ${getShoesColor(horse.shoesFront || false, horse.shoesBack || false)}`}>
                    {getShoesDisplay(horse.shoesFront || false, horse.shoesBack || false)}
                  </span>
                </TooltipTrigger>
                <TooltipContent>Shoe configuration (front / back)</TooltipContent>
              </Tooltip>
            </div>
          </div>
          {/* Sectional km-times from the most recent start */}
          {latestKmTime && (latestKmTime.first200 != null || latestKmTime.last200 != null || latestKmTime.best100 != null || latestKmTime.actualKMTime != null || latestKmTime.slipstreamDistance != null) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground border-t border-border/60 pt-1.5">
              {latestKmTime.first200 != null && (
                <span><span className="font-medium text-foreground/80">First 200:</span> <span className="tabular-nums">{latestKmTime.first200}</span></span>
              )}
              {latestKmTime.last200 != null && (
                <span><span className="font-medium text-foreground/80">Last 200:</span> <span className="tabular-nums">{latestKmTime.last200}</span></span>
              )}
              {latestKmTime.best100 != null && latestKmTime.best100 !== 'x' && (
                <span><span className="font-medium text-foreground/80">Best 100:</span> <span className="tabular-nums">{latestKmTime.best100}</span>{latestKmTime.best100start != null && latestKmTime.best100stop != null ? ` (${latestKmTime.best100start}–${latestKmTime.best100stop}m)` : ''}</span>
              )}
              {latestKmTime.actualKMTime != null && latestKmTime.actualKMTime !== 'N/A' && (
                <span><span className="font-medium text-foreground/80">Km:</span> <span className="tabular-nums">{latestKmTime.actualKMTime}</span></span>
              )}
              {latestKmTime.actualDistanceRan != null && typeof latestKmTime.actualDistanceRan === 'number' && (
                <span><span className="font-medium text-foreground/80">Dist:</span> <span className="tabular-nums">{latestKmTime.actualDistanceRan}m</span></span>
              )}
              {latestKmTime.slipstreamDistance != null && typeof latestKmTime.slipstreamDistance === 'number' && (
                <span><span className="font-medium text-foreground/80">Slip:</span> <span className="tabular-nums">{latestKmTime.slipstreamDistance}m</span></span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Winner card: margin-to-next confidence strip */}
      {isWinnerPick && marginPct !== undefined && (
        <div className="-mx-2 sm:-mx-3 -mb-2 sm:-mb-3 mt-2 rounded-b-xl overflow-hidden">
          <div className="h-1.5 bg-muted" role="img" aria-label={`Margin to next horse: ${marginLabel} seconds`}>
            <div className="h-full bg-primary transition-all" style={{ width: `${Math.max(marginPct, 4)}%` }} />
          </div>
          <div className="flex items-center justify-between px-3 py-1.5 bg-muted/40">
            <span className="eyebrow">Marginal +{marginLabel}s</span>
            <span className="eyebrow">
              {marginToNext! >= 0.8 ? 'Spikkandidat' : marginToNext! >= 0.3 ? 'Klar favorit' : 'Jämnt lopp — gardera'}
            </span>
            <span className="eyebrow" aria-hidden="true">{expanded ? '▲ detaljer' : '▼ detaljer'}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompactHorseRow;
