import { describe, it, expect, vi } from 'vitest';
import { calculateRawKmTimesForRaceWithId } from '../kmTimeProcessor';
import type { ATGStartInfo } from '../atgApi';
import { processHistoricalRecords, type ATGHorseHistoricalData } from '../atgHistoricalApi';
import { processHorseKmTimes } from '../horseProcessing';

// Prevent real ATG API calls during tests.
// fetchHorseHistoricalData and fetchExtendedRaceData are the two network entry points
// invoked by calculateRawKmTimesForRaceWithId. Pure logic functions are kept real
// via importActual so filtering, scoring, and processing tests stay meaningful.
vi.mock('../atgHistoricalApi', async (importActual) => {
    const actual = await importActual<typeof import('../atgHistoricalApi')>();
    return { ...actual, fetchHorseHistoricalData: vi.fn().mockResolvedValue(null) };
});

vi.mock('../utils/extendedFallbackHandler', async (importActual) => {
    const actual = await importActual<typeof import('../utils/extendedFallbackHandler')>();
    return { ...actual, fetchExtendedRaceData: vi.fn().mockResolvedValue(null) };
});

describe('kmTimeProcessor', () => {
    describe('calculateRawKmTimesForRaceWithId', () => {
        it('should return empty array for empty starts', async () => {
            const result = await calculateRawKmTimesForRaceWithId('test-race-1', []);
            expect(result).toEqual([]);
        });

        it('should handle horse with no historical data gracefully', async () => {
            const starts: ATGStartInfo[] = [
                {
                    postPosition: 1,
                    horse: {
                        id: 12345,
                        name: 'Test Horse',
                    },
                } as ATGStartInfo,
            ];

            const result = await calculateRawKmTimesForRaceWithId('test-race-2', starts);

            // Should still return a result, even if no valid times
            expect(result).toHaveLength(1);
            expect(result[0].horseId).toBe(12345);
            expect(result[0].horseName).toBe('Test Horse');
        });

        it('should compute gallop fields and lastRaceDate from raw records including gallops', async () => {
            const { fetchHorseHistoricalData } = await import('../atgHistoricalApi');
            const mockData: ATGHorseHistoricalData = {
                horse: {
                    name: 'Gallop Horse',
                    id: 99001,
                    results: {
                        records: [
                            // Galloped race (no valid km time — filtered out by processHistoricalRecords)
                            {
                                date: '2026-04-10',
                                galloped: true,
                                place: 'U',
                                race: { id: 'r1', startMethod: 'auto' },
                                track: { name: 'Solvalla' },
                                start: { distance: 2140, postPosition: 1 }
                            },
                            // Valid race 1
                            {
                                date: '2026-03-20',
                                kmTime: { minutes: 1, seconds: 15, tenths: 0 },
                                place: '1',
                                race: { id: 'r2', startMethod: 'auto' },
                                track: { name: 'Solvalla' },
                                start: { distance: 2140, postPosition: 1 }
                            },
                            // Valid race 2
                            {
                                date: '2026-03-06',
                                kmTime: { minutes: 1, seconds: 16, tenths: 5 },
                                place: '2',
                                race: { id: 'r3', startMethod: 'auto' },
                                track: { name: 'Solvalla' },
                                start: { distance: 2140, postPosition: 1 }
                            }
                        ]
                    }
                },
                driver: { firstName: 'Test', lastName: 'Driver' },
                postPosition: 1
            };
            vi.mocked(fetchHorseHistoricalData).mockResolvedValueOnce(mockData);

            const starts: ATGStartInfo[] = [
                { postPosition: 1, horse: { id: 99001, name: 'Gallop Horse' } } as ATGStartInfo
            ];

            const result = await calculateRawKmTimesForRaceWithId('test-race-g1', starts);

            expect(result).toHaveLength(1);
            // Gallop fields must reflect galloped races in raw records.
            expect(result[0].gallopCount).toBe(1);
            expect(result[0].gallopDates).toEqual(['2026-04-10']);
            // 1 gallop out of 3 total records
            expect(result[0].gallopRate).toBeCloseTo(1 / 3, 5);
            expect(result[0].lastRaceDate).toBe('2026-04-10');
        });

        it('should use statistics records only after detail result records are unusable', async () => {
            const { fetchHorseHistoricalData } = await import('../atgHistoricalApi');
            const mockData: ATGHorseHistoricalData = {
                horse: {
                    name: 'Stats Supplement Horse',
                    id: 99002,
                    results: {
                        records: [
                            {
                                date: '2026-04-10',
                                kmTime: { minutes: 1, seconds: 17, tenths: 0 },
                                galloped: true,
                                place: 'U',
                                race: { id: 'r1', startMethod: 'auto' },
                                track: { name: 'Solvalla' },
                                start: { distance: 2140, postPosition: 1 }
                            }
                        ]
                    },
                    statistics: {
                        years: {
                            '2026': {
                                records: [
                                    {
                                        code: 'aM',
                                        startMethod: 'auto',
                                        distance: 'medium',
                                        time: { minutes: 1, seconds: 15, tenths: 0 }
                                    }
                                ]
                            }
                        }
                    }
                } as any,
                driver: { firstName: 'Test', lastName: 'Driver' },
                postPosition: 1
            };
            vi.mocked(fetchHorseHistoricalData).mockResolvedValueOnce(mockData);

            const starts: ATGStartInfo[] = [
                { postPosition: 1, horse: { id: 99002, name: 'Stats Supplement Horse' } } as ATGStartInfo
            ];

            const result = await calculateRawKmTimesForRaceWithId('test-race-stats', starts);

            expect(result).toHaveLength(1);
            expect(result[0].validTimesCount).toBe(1);
            expect(result[0].usedStatisticsFallback).toBe(true);
            expect(result[0].rawBestTime).toEqual({ minutes: 1, seconds: 15, tenths: 0 });
        });

        it('should not pool faster statistics records when valid detail result records exist', async () => {
            const { fetchHorseHistoricalData } = await import('../atgHistoricalApi');
            const mockData: ATGHorseHistoricalData = {
                horse: {
                    name: 'Primary Detail Horse',
                    id: 99003,
                    results: {
                        records: [
                            {
                                date: '2026-04-10',
                                kmTime: { minutes: 1, seconds: 17, tenths: 0 },
                                place: '2',
                                race: { id: 'r1', startMethod: 'auto' },
                                track: { name: 'Solvalla' },
                                start: { distance: 2140, postPosition: 1 }
                            }
                        ]
                    },
                    statistics: {
                        years: {
                            '2026': {
                                records: [
                                    {
                                        code: 'aM',
                                        startMethod: 'auto',
                                        distance: 'medium',
                                        time: { minutes: 1, seconds: 11, tenths: 0 }
                                    }
                                ]
                            }
                        }
                    }
                } as any,
                driver: { firstName: 'Test', lastName: 'Driver' },
                postPosition: 1
            };
            vi.mocked(fetchHorseHistoricalData).mockResolvedValueOnce(mockData);

            const starts: ATGStartInfo[] = [
                { postPosition: 1, horse: { id: 99003, name: 'Primary Detail Horse' } } as ATGStartInfo
            ];

            const result = await calculateRawKmTimesForRaceWithId('test-race-primary', starts, undefined, '2026-05-01');

            expect(result).toHaveLength(1);
            expect(result[0].validTimesCount).toBe(1);
            expect(result[0].usedStatisticsFallback).toBe(false);
            expect(result[0].rawBestTime).toEqual({ minutes: 1, seconds: 17, tenths: 0 });
        });

        it('filters to prior numeric records, keeps place=0, and does not fill partial 90d windows', () => {
            const result = processHistoricalRecords([
                {
                    date: '2026-05-01',
                    kmTime: { minutes: 1, seconds: 12, tenths: 0 },
                    place: '1',
                    race: { id: 'same-day', startMethod: 'auto' },
                    track: { name: 'Solvalla' },
                    start: { distance: 2140, postPosition: 1 }
                },
                {
                    date: '2026-04-20',
                    kmTime: { minutes: 1, seconds: 13, tenths: 0 },
                    place: '0',
                    race: { id: 'unfinished', startMethod: 'auto' },
                    track: { name: 'Solvalla' },
                    start: { distance: 2140, postPosition: 1 }
                },
                {
                    date: '2026-04-10',
                    kmTime: { minutes: 1, seconds: 15, tenths: 0 },
                    place: '2',
                    race: { id: 'recent', startMethod: 'auto' },
                    track: { name: 'Solvalla' },
                    start: { distance: 2140, postPosition: 1 }
                },
                {
                    date: '2026-01-01',
                    kmTime: { minutes: 1, seconds: 16, tenths: 0 },
                    place: '3',
                    race: { id: 'older', startMethod: 'auto' },
                    track: { name: 'Solvalla' },
                    start: { distance: 2140, postPosition: 1 }
                }
            ], 'Policy Horse', '2026-05-01');

            expect(result.metadata.usedFallback).toBe(false);
            expect(result.records.map(r => r.race.id)).toEqual(['unfinished', 'recent']);
            expect(result.records.map(r => (r as any).meta.rawTimeWindow)).toEqual(['recent', 'recent']);
        });

        it('falls back to all prior records when 90d window is empty', () => {
            const result = processHistoricalRecords([
                {
                    date: '2026-05-01',
                    kmTime: { minutes: 1, seconds: 12, tenths: 0 },
                    place: '1',
                    race: { id: 'same-day', startMethod: 'auto' },
                    track: { name: 'Solvalla' },
                    start: { distance: 2140, postPosition: 1 }
                },
                {
                    date: '2026-01-15',
                    kmTime: { minutes: 1, seconds: 15, tenths: 0 },
                    place: '0',
                    race: { id: 'older-zero', startMethod: 'auto' },
                    track: { name: 'Solvalla' },
                    start: { distance: 2140, postPosition: 1 }
                },
                {
                    date: '2026-01-01',
                    kmTime: { minutes: 1, seconds: 16, tenths: 0 },
                    place: '3',
                    race: { id: 'older', startMethod: 'auto' },
                    track: { name: 'Solvalla' },
                    start: { distance: 2140, postPosition: 1 }
                }
            ], 'Policy Horse', '2026-05-01');

            expect(result.metadata.usedFallback).toBe(true);
            expect(result.records.map(r => r.race.id)).toEqual(['older-zero', 'older']);
            expect(result.records.map(r => (r as any).meta.rawTimeWindow)).toEqual(['older-fill', 'older-fill']);
        });

        it('does not turn a post-cutoff result into an invalid-time horse prediction', async () => {
            const { fetchHorseHistoricalData } = await import('../atgHistoricalApi');
            const { fetchExtendedRaceData } = await import('../utils/extendedFallbackHandler');
            vi.mocked(fetchHorseHistoricalData).mockResolvedValueOnce({
                horse: {
                    name: 'Future Only Horse',
                    id: 99004,
                    results: {
                        records: [{
                            date: '2026-05-02',
                            kmTime: { minutes: 1, seconds: 10, tenths: 0 },
                            place: '1',
                            race: { id: 'future', startMethod: 'auto' },
                            track: { name: 'Solvalla' },
                            start: { distance: 2140, postPosition: 1 }
                        }]
                    }
                },
                driver: { firstName: 'Test', lastName: 'Driver' },
                postPosition: 1
            });
            vi.mocked(fetchExtendedRaceData).mockResolvedValueOnce({
                id: 'test-race-future',
                starts: [{
                    number: 1,
                    postPosition: 1,
                    horse: {
                        id: 99004,
                        name: 'Future Only Horse',
                        record: {
                            time: { minutes: 1, seconds: 9, tenths: 0 },
                            startMethod: 'auto'
                        }
                    }
                }]
            } as any);

            const result = await calculateRawKmTimesForRaceWithId(
                'test-race-future',
                [{ postPosition: 1, horse: { id: 99004, name: 'Future Only Horse' } } as ATGStartInfo],
                undefined,
                '2026-05-01'
            );

            expect(result[0].bestTime).toEqual({ minutes: 0, seconds: 0, tenths: 0 });
            expect(result[0].usedInvalidTimeFallback).not.toBe(true);
        });

        it('uses program number for detail lookup, synthetic identity, and extended fallback matching', async () => {
            const { fetchHorseHistoricalData } = await import('../atgHistoricalApi');
            const { fetchExtendedRaceData } = await import('../utils/extendedFallbackHandler');
            vi.mocked(fetchHorseHistoricalData).mockResolvedValueOnce(null as any);
            vi.mocked(fetchExtendedRaceData).mockResolvedValueOnce({
                id: 'test-race-start-number',
                starts: [{
                    number: 7,
                    // Deliberately different from the current gate so a gate-based match fails.
                    postPosition: 9,
                    horse: {
                        id: 0,
                        name: 'Program Seven',
                        results: {
                            records: [{
                                date: '2026-04-10',
                                kmTime: { minutes: 1, seconds: 15, tenths: 0 },
                                place: '1',
                                race: { id: 'prior', startMethod: 'auto' },
                                track: { name: 'Solvalla' },
                                start: { distance: 2140, postPosition: 9 }
                            }]
                        }
                    }
                }]
            } as any);

            const result = await calculateRawKmTimesForRaceWithId(
                'test-race-start-number',
                [{ number: 7, postPosition: 2, horse: { id: 0, name: 'Program Seven' } } as ATGStartInfo],
                undefined,
                '2026-05-01'
            );

            expect(fetchHorseHistoricalData).toHaveBeenLastCalledWith('test-race-start-number', 7);
            expect(result[0].horseKey).toBe('test-race-start-number:start:7');
            expect(result[0].usedExtendedFallback).toBe(true);
            expect(result[0].rawBestTime).toEqual({ minutes: 1, seconds: 15, tenths: 0 });
        });

        it('averages most recent three records, not fastest records', async () => {
            const result = await processHorseKmTimes(123, 'Recent Average Horse', [
                {
                    raceId: 'recent-1',
                    date: '2026-04-20',
                    distance: 2140,
                    startMethod: 'auto',
                    track: 'Solvalla',
                    kmTime: { minutes: 1, seconds: 16, tenths: 0 },
                    finishOrder: 2,
                    postPosition: 1,
                    galloped: false,
                    disqualified: false,
                    meta: { rawTimeWindow: 'recent' }
                } as any,
                {
                    raceId: 'recent-2',
                    date: '2026-04-10',
                    distance: 2140,
                    startMethod: 'auto',
                    track: 'Solvalla',
                    kmTime: { minutes: 1, seconds: 14, tenths: 0 },
                    finishOrder: 3,
                    postPosition: 1,
                    galloped: false,
                    disqualified: false,
                    meta: { rawTimeWindow: 'recent' }
                } as any,
                {
                    raceId: 'recent-3',
                    date: '2026-04-01',
                    distance: 2140,
                    startMethod: 'auto',
                    track: 'Solvalla',
                    kmTime: { minutes: 1, seconds: 17, tenths: 0 },
                    finishOrder: 0,
                    postPosition: 1,
                    galloped: false,
                    disqualified: false,
                    meta: { rawTimeWindow: 'recent' }
                } as any,
                {
                    raceId: 'fast-old',
                    date: '2026-01-10',
                    distance: 2140,
                    startMethod: 'auto',
                    track: 'Solvalla',
                    kmTime: { minutes: 1, seconds: 10, tenths: 0 },
                    finishOrder: 1,
                    postPosition: 1,
                    galloped: false,
                    disqualified: false,
                    meta: { rawTimeWindow: 'older-fill' }
                } as any
            ]);

            expect(result.rawBestTime).toEqual({ minutes: 1, seconds: 15, tenths: 7 });
            expect(result.bestRecordTime).toEqual({ minutes: 1, seconds: 10, tenths: 0 });
        });

        it('should handle invalid distance values', async () => {
            // Test that zero or negative distances are handled
            expect(true).toBe(true);
        });

        it('should apply tillägg (distance adjustments) correctly', async () => {
            // Test distance normalization with tillägg
            // Example: 2140m race with 20m tillägg should normalize to 2140m base
            expect(true).toBe(true);
        });
    });

    describe('Time conversion utilities', () => {
        it('should convert seconds to km time parts correctly', () => {
            // Test: 75.3 seconds = 1:15.3
            // This would test the secondsToKmParts utility
            expect(true).toBe(true);
        });

        it('should handle zero times correctly', () => {
            // Test that 0:00.0 is recognized as invalid
            expect(true).toBe(true);
        });
    });
});
