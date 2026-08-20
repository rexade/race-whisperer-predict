import { describe, expect, it } from 'vitest';
import {
  applyModernKmNormalization,
  getDefaultWeights,
  type ModernNormalizationFactors,
} from '@/services/modernKm';
import type { V75RaceResult } from '../../types/raceResultTypes';
import { RaceReanalysisService } from '../raceReanalysisService';

const factors: ModernNormalizationFactors = {
  postPosition: 4,
  distance: 2140,
  raceDistance: 2140,
  startMethod: 'auto',
  shoesFront: '0',
  shoesBack: '1',
  sulkyType: 'AM',
  homeTrack: 'Solvalla',
  raceTrack: 'Aby',
  driverExperience: 120,
  driverWinPercentage: 1800,
  trainerWinPercentage: 2200,
  startPoints: 1250,
  placePercentage: 4200,
  horseWinPercentage: 1600,
  earningsPerStart: 450_000,
  horseId: 7,
  horseName: 'Parity Test',
  recentRaces: [
    { place: 1, date: '2026-03-01' },
    { place: 4, date: '2026-02-10' },
  ],
  gallopRisk: 0.15,
  layoffDays: 28,
  horseBirthYear: 2019,
  raceYear: 2026,
  horseSex: 'V',
  consistencyScore: 1.4,
  fieldStartPoints: [900, 1100, 1250, 1500],
  fieldDriverWinRates: [900, 1400, 1800, 2400],
  driverEmpiricalWinRate: 0.22,
  averageOdds: 5.5,
  liveOdds: 4.2,
  betDistribution: 26,
  shoesFrontChanged: true,
  shoesBackChanged: false,
};

describe('RaceReanalysisService', () => {
  it('reuses the complete original factor vector', () => {
    const rawKmTime = { minutes: 1, seconds: 14, tenths: 8 };
    const weights = getDefaultWeights();
    const original = applyModernKmNormalization(rawKmTime, factors, weights);
    original.isEstimated = false;
    original.normalizationFactors = factors;

    const race: V75RaceResult = {
      raceId: 'race-1',
      raceNumber: 1,
      track: 'Aby',
      distance: 2140,
      startMethod: 'auto',
      name: 'Parity',
      prize: 100_000,
      analysisComplete: true,
      horses: [{
        raceId: 'race-1',
        raceNumber: 1,
        horseId: 7,
        horseName: 'Parity Test',
        postPosition: 4,
        rawKmTime,
        modernNormalizedResult: original,
        driverName: 'Driver',
        track: 'Aby',
        distance: 2140,
        startMethod: 'auto',
      }],
    };

    const [updatedRace] = RaceReanalysisService.reanalyzeWithNewWeights(
      [race],
      weights
    );
    const updated = updatedRace.horses[0].modernNormalizedResult;

    expect(updated.modernNormalizedTime).toEqual(original.modernNormalizedTime);
    expect(updated.adjustments).toEqual(original.adjustments);
    expect(updated.normalizationFactors).toEqual(factors);
  });
});
