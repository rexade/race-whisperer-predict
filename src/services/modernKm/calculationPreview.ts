import { KmTime, addSecondsToKmTime, cloneKmTime } from '../utils/kmTimeUtils';
import { ModernNormalizationFactors, NormalizationWeights } from './types';
import { calculatePostPositionAdjustment } from './postPositionCalculator';
import { calculateShoeAdjustment, calculateSulkyAdjustment } from './equipmentCalculators';
import { calculateDriverAdjustment } from './driverCalculators';
import { 
  calculateStartPointsAdjustment,
  calculatePlacePercentageAdjustment,
  calculateHorseWinPercentageAdjustment,
  calculateEarningsPerStartAdjustment
} from './performanceCalculators';
import {
  calculateDistanceAdjustment,
  calculateRaceDistanceAdjustment,
  calculateTrackFamiliarityAdjustment,
  calculateVolteStartDistancePenalty
} from './adjustmentCalculators';

export interface FactorContribution {
  factor: string;
  rawAdjustment: number;
  weightedAdjustment: number;
  weight: number;
  impactLevel: 'low' | 'medium' | 'high';
  description: string;
}

export interface PreviewCalculation {
  baseTime: KmTime;
  finalTime: KmTime;
  totalAdjustment: number;
  contributions: FactorContribution[];
  summary: {
    topFactors: FactorContribution[];
    totalFactorsUsed: number;
    maxImpact: number;
    minImpact: number;
  };
}

export const calculatePreview = (
  baseKmTime: KmTime,
  factors: ModernNormalizationFactors,
  weights: NormalizationWeights
): PreviewCalculation => {
  const contributions: FactorContribution[] = [];

  // Calculate each factor's contribution
  const postPositionRaw = calculatePostPositionAdjustment(factors.postPosition, factors.startMethod);
  const postPositionWeighted = postPositionRaw * weights.postPosition;
  contributions.push({
    factor: 'postPosition',
    rawAdjustment: postPositionRaw,
    weightedAdjustment: postPositionWeighted,
    weight: weights.postPosition,
    impactLevel: getImpactLevel(Math.abs(postPositionWeighted)),
    description: `Starting position ${factors.postPosition} (${factors.startMethod})`
  });

  const shoeRaw = calculateShoeAdjustment(factors.shoesFront, factors.shoesBack);
  const shoeWeighted = shoeRaw * weights.shoeType;
  contributions.push({
    factor: 'shoes',
    rawAdjustment: shoeRaw,
    weightedAdjustment: shoeWeighted,
    weight: weights.shoeType,
    impactLevel: getImpactLevel(Math.abs(shoeWeighted)),
    description: `Shoes: Front ${factors.shoesFront}, Back ${factors.shoesBack}`
  });

  const sulkyRaw = calculateSulkyAdjustment(factors.sulkyType);
  const sulkyWeighted = sulkyRaw * weights.sulkyType;
  contributions.push({
    factor: 'sulky',
    rawAdjustment: sulkyRaw,
    weightedAdjustment: sulkyWeighted,
    weight: weights.sulkyType,
    impactLevel: getImpactLevel(Math.abs(sulkyWeighted)),
    description: `Sulky type: ${factors.sulkyType}`
  });

  const driverRaw = calculateDriverAdjustment(factors.driverWinPercentage, factors.postPosition);
  const driverWeighted = driverRaw * weights.driverPerformance;
  contributions.push({
    factor: 'driver',
    rawAdjustment: driverRaw,
    weightedAdjustment: driverWeighted,
    weight: weights.driverPerformance,
    impactLevel: getImpactLevel(Math.abs(driverWeighted)),
    description: `Driver win rate: ${factors.driverWinPercentage}%`
  });

  const distanceRaw = calculateDistanceAdjustment(factors.distance, factors.raceDistance);
  const distanceWeighted = distanceRaw * weights.distanceAdjustment;
  contributions.push({
    factor: 'distance',
    rawAdjustment: distanceRaw,
    weightedAdjustment: distanceWeighted,
    weight: weights.distanceAdjustment,
    impactLevel: getImpactLevel(Math.abs(distanceWeighted)),
    description: `Distance: ${factors.distance}m vs race ${factors.raceDistance}m`
  });

  const raceDistanceRaw = calculateRaceDistanceAdjustment(factors.raceDistance);
  const raceDistanceWeighted = raceDistanceRaw * weights.raceDistanceAdjustment;
  contributions.push({
    factor: 'raceDistance',
    rawAdjustment: raceDistanceRaw,
    weightedAdjustment: raceDistanceWeighted,
    weight: weights.raceDistanceAdjustment,
    impactLevel: getImpactLevel(Math.abs(raceDistanceWeighted)),
    description: `Race distance: ${factors.raceDistance}m from 2140m baseline`
  });

  const trackFamiliarityRaw = calculateTrackFamiliarityAdjustment(factors.homeTrack, "UNKNOWN");
  const trackFamiliarityWeighted = trackFamiliarityRaw * weights.trackFamiliarity;
  contributions.push({
    factor: 'trackFamiliarity',
    rawAdjustment: trackFamiliarityRaw,
    weightedAdjustment: trackFamiliarityWeighted,
    weight: weights.trackFamiliarity,
    impactLevel: getImpactLevel(Math.abs(trackFamiliarityWeighted)),
    description: `Track familiarity: ${factors.homeTrack}`
  });

  const volteRaw = calculateVolteStartDistancePenalty(factors.startMethod);
  const volteWeighted = volteRaw * weights.volteStartDistancePenalty;
  contributions.push({
    factor: 'volteStart',
    rawAdjustment: volteRaw,
    weightedAdjustment: volteWeighted,
    weight: weights.volteStartDistancePenalty,
    impactLevel: getImpactLevel(Math.abs(volteWeighted)),
    description: `Volte start penalty: ${factors.startMethod}`
  });

  const startPointsRaw = calculateStartPointsAdjustment(factors.startPoints);
  const startPointsWeighted = startPointsRaw * weights.startPoints;
  contributions.push({
    factor: 'startPoints',
    rawAdjustment: startPointsRaw,
    weightedAdjustment: startPointsWeighted,
    weight: weights.startPoints,
    impactLevel: getImpactLevel(Math.abs(startPointsWeighted)),
    description: `Start points: ${factors.startPoints}`
  });

  const placePercentageRaw = calculatePlacePercentageAdjustment(factors.placePercentage);
  const placePercentageWeighted = placePercentageRaw * weights.placePercentage;
  contributions.push({
    factor: 'placePercentage',
    rawAdjustment: placePercentageRaw,
    weightedAdjustment: placePercentageWeighted,
    weight: weights.placePercentage,
    impactLevel: getImpactLevel(Math.abs(placePercentageWeighted)),
    description: `Place percentage: ${(factors.placePercentage / 100).toFixed(1)}%`
  });

  const horseWinRaw = calculateHorseWinPercentageAdjustment(factors.horseWinPercentage);
  const horseWinWeighted = horseWinRaw * weights.horseWinPercentage;
  contributions.push({
    factor: 'horseWinPercentage',
    rawAdjustment: horseWinRaw,
    weightedAdjustment: horseWinWeighted,
    weight: weights.horseWinPercentage,
    impactLevel: getImpactLevel(Math.abs(horseWinWeighted)),
    description: `Horse win rate: ${(factors.horseWinPercentage / 100).toFixed(1)}%`
  });

  const earningsRaw = calculateEarningsPerStartAdjustment(factors.earningsPerStart);
  const earningsWeighted = earningsRaw * weights.earningsPerStart;
  contributions.push({
    factor: 'earningsPerStart',
    rawAdjustment: earningsRaw,
    weightedAdjustment: earningsWeighted,
    weight: weights.earningsPerStart,
    impactLevel: getImpactLevel(Math.abs(earningsWeighted)),
    description: `Earnings per start: ${Math.round(factors.earningsPerStart / 100)} SEK`
  });

  // Calculate totals
  const totalAdjustment = contributions.reduce((sum, c) => sum + c.weightedAdjustment, 0);
  const finalTime = addSecondsToKmTime(cloneKmTime(baseKmTime), totalAdjustment);

  // Create summary
  const sortedContributions = [...contributions].sort((a, b) => 
    Math.abs(b.weightedAdjustment) - Math.abs(a.weightedAdjustment)
  );
  
  const topFactors = sortedContributions.slice(0, 5);
  const impacts = contributions.map(c => Math.abs(c.weightedAdjustment));

  return {
    baseTime: cloneKmTime(baseKmTime),
    finalTime,
    totalAdjustment,
    contributions,
    summary: {
      topFactors,
      totalFactorsUsed: contributions.filter(c => c.weightedAdjustment !== 0).length,
      maxImpact: Math.max(...impacts),
      minImpact: Math.min(...impacts)
    }
  };
};

const getImpactLevel = (absoluteAdjustment: number): 'low' | 'medium' | 'high' => {
  if (absoluteAdjustment >= 0.2) return 'high';
  if (absoluteAdjustment >= 0.05) return 'medium';
  return 'low';
};

export const getSampleFactors = (): ModernNormalizationFactors => ({
  postPosition: 5,
  distance: 2140,
  raceDistance: 2140,
  startMethod: 'auto',
  shoesFront: '1',
  shoesBack: '1',
  sulkyType: 'VA',
  homeTrack: 'Solvalla',
  driverExperience: 10,
  driverWinPercentage: 18,
  horseForm: 3,
  startPoints: 500,
  placePercentage: 5000, // 50%
  horseWinPercentage: 1500, // 15%
  earningsPerStart: 300000 // 3000 SEK in öre
});