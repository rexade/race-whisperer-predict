import { useQuery } from "@tanstack/react-query";
import { fetchRaceDataForGame, fetchGamesForDate, V75GameInfo } from "@/services/v75CalendarApi";
import { GAME_TYPE, GameType } from "@/config/game";

/**
 * Hook to fetch every playable game on a date — the picker's whole menu.
 */
export const useDayGames = (date: string | undefined | null) =>
    useQuery({
        queryKey: ["dayGames", date],
        queryFn: () => {
            if (!date) return [];
            return fetchGamesForDate(date);
        },
        enabled: !!date,
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
