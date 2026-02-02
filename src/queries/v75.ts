import { useQuery } from "@tanstack/react-query";
import { fetchV75GameInfo, fetchRaceDataForGame, V75GameInfo } from "@/services/v75CalendarApi";

/**
 * Hook to fetch game info for a specific date
 */
export const useGameInfo = (date: string | undefined | null) =>
    useQuery({
        queryKey: ["gameInfo", date],
        queryFn: () => {
            if (!date) return null;
            return fetchV75GameInfo(date);
        },
        enabled: !!date,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

/**
 * Hook to fetch full race data for a game
 * Dependent on gameInfo being available
 */
export const useRaceData = (date: string | undefined | null, gameInfo: V75GameInfo | undefined | null) =>
    useQuery({
        queryKey: ["raceData", date, gameInfo?.gameId],
        queryFn: async () => {
            if (!date || !gameInfo) return [];
            return fetchRaceDataForGame(date, gameInfo);
        },
        enabled: !!date && !!gameInfo,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
