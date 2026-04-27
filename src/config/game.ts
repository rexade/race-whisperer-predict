export type GameType = "V75" | "V85" | "V86" | "V65";

const env = (import.meta as any).env ?? {};

export const GAME_TYPE: GameType =
  (env.VITE_GAME_TYPE as GameType) ?? "V75";

export const IS_DEBUG =
  (env.VITE_DEBUG_LOGS ?? "") === "1";
