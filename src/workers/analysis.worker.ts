import { RaceResultProcessor } from '../components/v75/services/raceResultProcessor';
import { NormalizationWeights, PostPositionCurves } from '../services/modernKm/index';
import { HorseRawKmTime } from '../services/types/kmTimeTypes';
import { V75RaceResult } from '../components/v75/types/raceResultTypes';
import { primeDriverRatingCache } from '../services/calibration/driverRatingService';
import type { GameType } from '../config/game';

// Message types for worker communication
export interface AnalyzeRaceMessage {
    type: 'ANALYZE_RACE';
    payload: {
        race: any;
        rawKmTimes: HorseRawKmTime[];
        weights: NormalizationWeights;
        analysisDate?: string;
        postPositionCurves?: PostPositionCurves;
        driverRatings: Record<string, number>;
        gameType: GameType;
    };
}

export interface ProgressMessage {
    type: 'PROGRESS';
    payload: {
        current: number;
        total: number;
        label: string;
    };
}

export interface ResultMessage {
    type: 'RESULT';
    payload: {
        raceResult: V75RaceResult;
    };
}

export interface ErrorMessage {
    type: 'ERROR';
    payload: {
        message: string;
    };
}

export type WorkerMessage = AnalyzeRaceMessage;
export type WorkerResponse = ProgressMessage | ResultMessage | ErrorMessage;

// Worker message handler
self.onmessage = async (event: MessageEvent<any>) => {
    const { requestId, type, payload } = event.data;

    if (type === 'PROCESS_RACE') {
        try {
            const { race, rawKmTimes, weights, analysisDate, postPositionCurves, driverRatings, gameType } = payload;

            primeDriverRatingCache(driverRatings ?? {}, gameType);

            // Process the race (pure computation, no side effects)
            const raceResult = await RaceResultProcessor.processRaceResult(
                race,
                rawKmTimes,
                weights,
                analysisDate,
                postPositionCurves
            );

            // Send result back to main thread with requestId
            (self as any).postMessage({
                requestId,
                type: 'DONE',
                payload: { raceResult }
            });

        } catch (error) {
            // Send error back to main thread
            (self as any).postMessage({
                requestId,
                type: 'ERROR',
                error: error instanceof Error ? error.message : 'Unknown error in worker'
            });
        }
    } else {
        (self as any).postMessage({
            requestId,
            type: 'ERROR',
            error: 'Unknown message type'
        });
    }
};
