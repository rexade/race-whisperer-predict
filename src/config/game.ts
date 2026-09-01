/**
 * ATG bet types the analyzer can score, spelled exactly as the racing-info API
 * keys them (`dd`, `ld` and `vinnare` are lowercase there; the V-games are not).
 */
export type GameType =
  | "V75"
  | "GS75"
  | "V86"
  | "V85"
  | "V65"
  | "V64"
  | "V5"
  | "V4"
  | "V3"
  | "dd"
  | "ld"
  | "raket"
  | "vinnare";

/**
 * Display order for the game picker — biggest pools first, single races last.
 *
 * Deliberately excludes plats/vp/trio/komb/tvilling/top7: those are other bet
 * types on races `vinnare` already lists, so including them would show the same
 * race up to six times.
 */
export const SUPPORTED_GAME_TYPES: readonly GameType[] = [
  "V75",
  "GS75",
  "V86",
  "V85",
  "V65",
  "V64",
  "V5",
  "V4",
  "V3",
  "dd",
  "ld",
  "raket",
  "vinnare",
];

export const GAME_TYPE_LABELS: Record<GameType, string> = {
  V75: "V75",
  GS75: "Grand Slam 75",
  V86: "V86",
  V85: "V85",
  V65: "V65",
  V64: "V64",
  V5: "V5",
  V4: "V4",
  V3: "V3",
  dd: "Dagens Dubbel",
  ld: "Lunch Dubbel",
  raket: "Raket",
  vinnare: "Enloppsspel",
};

export const isSupportedGameType = (value: string): value is GameType =>
  SUPPORTED_GAME_TYPES.includes(value as GameType);

const env = (import.meta as any).env ?? {};

/**
 * Fallback game type for callers that still ask "the V85 of this date" — the
 * calibration scripts and CLI evaluators. The UI picks a concrete game instead.
 */
export const GAME_TYPE: GameType =
  (env.VITE_GAME_TYPE as GameType) ?? "V85";

export const IS_DEBUG =
  (env.VITE_DEBUG_LOGS ?? "") === "1";
