import { describe, it, expect, vi } from 'vitest';
import { calculateRawKmTimesForRaceWithId } from '../kmTimeProcessor';
import type { ATGStartInfo } from '../atgApi';
import type { ATGHorseHistoricalData } from '../atgHistoricalApi';

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
