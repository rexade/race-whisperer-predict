import { RaceResultProcessor } from '../components/v75/services/raceResultProcessor';
import { NormalizationWeights, PostPositionCurves } from '../services/modernKm/index';
import { HorseRawKmTime } from '../services/types/kmTimeTypes';
import { V75RaceResult } from '../components/v75/types/raceResultTypes';

// Message types for worker communication
export interface AnalyzeRaceMessage {
    type: 'ANALYZE_RACE';
    payload: {
        race: any;
        rawKmTimes: HorseRawKmTime[];
        weights: NormalizationWeights;
        analysisDate?: string;
        postPositionCurves?: PostPositionCurves;
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
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
    const message = event.data;

    if (message.type === 'ANALYZE_RACE') {
        try {
            const { race, rawKmTimes, weights, analysisDate, postPositionCurves } = message.payload;

            // Process the race (pure computation, no side effects)
            const raceResult = await RaceResultProcessor.processRaceResult(
                race,
                rawKmTimes,
                weights,
                analysisDate,
                postPositionCurves
            );

            // Send result back to main thread
            const response: ResultMessage = {
                type: 'RESULT',
                payload: { raceResult }
            };
            self.postMessage(response);

        } catch (error) {
            // Send error back to main thread
            const response: ErrorMessage = {
                type: 'ERROR',
                payload: {
                    message: error instanceof Error ? error.message : 'Unknown error in worker'
                }
            };
            self.postMessage(response);
        }
    }
};
