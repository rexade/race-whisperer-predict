export type GameType = "V75" | "V85" | "V86" | "V65";

export const GAME_TYPE: GameType =
  (import.meta.env.VITE_GAME_TYPE as GameType) ?? "V75";

export const IS_DEBUG =
  (import.meta.env.VITE_DEBUG_LOGS ?? "") === "1";
