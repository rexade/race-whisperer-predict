import { useQuery } from "@tanstack/react-query";
import { fetchV75GameInfo, fetchRaceDataForGame, fetchAvailableGameTypes, V75GameInfo } from "@/services/v75CalendarApi";
import { GAME_TYPE, GameType } from "@/config/game";

/**
 * Hook to fetch game info for a specific date and game type
 */
export const useGameInfo = (date: string | undefined | null, gameType: GameType = GAME_TYPE) =>
    useQuery({
        queryKey: ["gameInfo", gameType, date],
        queryFn: () => {
            if (!date) return null;
            return fetchV75GameInfo(date, gameType);
        },
        enabled: !!date,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

/**
 * Hook to fetch all available game types for a date (only fires when gameInfo is null)
 */
export const useAvailableGameTypes = (date: string | undefined | null, skip: boolean) =>
    useQuery({
        queryKey: ["availableGameTypes", date],
        queryFn: () => {
            if (!date) return [];
            return fetchAvailableGameTypes(date);
        },
        enabled: !!date && !skip,
        staleTime: 5 * 60 * 1000,
    });

/**
 * Hook to fetch full race data for a game
 * Dependent on gameInfo being available
 */
export const useRaceData = (date: string | undefined | null, gameInfo: V75GameInfo | undefined | null, gameType: GameType = GAME_TYPE) =>
    useQuery({
        queryKey: ["raceData", gameType, date, gameInfo?.gameId],
        queryFn: async () => {
            if (!date || !gameInfo) return [];
            return fetchRaceDataForGame(date, gameInfo, gameType);
        },
        enabled: !!date && !!gameInfo,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
