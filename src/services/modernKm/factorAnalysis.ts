import { FactorContribution } from './calculationPreview';
import { NormalizationWeights } from './types';

export interface FactorImpactAnalysis {
  factorDistribution: {
    factor: string;
    averageImpact: number;
    maxImpact: number;
    frequency: number;
    category: 'equipment' | 'performance' | 'race' | 'position';
  }[];
  weightEffectiveness: {
    factor: string;
    currentWeight: number;
    suggestedWeight: number;
    reasoning: string;
    improvement: number;
  }[];
  correlations: {
    factor1: string;
    factor2: string;
    correlation: number;
    significance: 'low' | 'medium' | 'high';
  }[];
}

export const analyzeFactorImpacts = (
  contributionHistory: FactorContribution[][],
  weights: NormalizationWeights
): FactorImpactAnalysis => {
  const factorStats = calculateFactorStatistics(contributionHistory);
  const weightEffectiveness = analyzeWeightEffectiveness(factorStats, weights);
  const correlations = calculateFactorCorrelations(contributionHistory);

  return {
    factorDistribution: factorStats,
    weightEffectiveness,
    correlations
  };
};

const calculateFactorStatistics = (contributionHistory: FactorContribution[][]) => {
  const factorData: Record<string, {
    impacts: number[];
    category: 'equipment' | 'performance' | 'race' | 'position';
  }> = {};

  // Initialize factor data
  const factorCategories: Record<string, 'equipment' | 'performance' | 'race' | 'position'> = {
    postPosition: 'position',
    shoes: 'equipment',
    sulky: 'equipment',
    driver: 'performance',
    distance: 'race',
    raceDistance: 'race',
    raceType: 'race',
    timeOfDay: 'race',
    volteStart: 'race',
    startPoints: 'performance',
    placePercentage: 'performance',
    horseWinPercentage: 'performance',
    earningsPerStart: 'performance'
  };

  Object.keys(factorCategories).forEach(factor => {
    factorData[factor] = {
      impacts: [],
      category: factorCategories[factor]
    };
  });

  // Collect impact data
  contributionHistory.forEach(contributions => {
    contributions.forEach(contribution => {
      if (factorData[contribution.factor]) {
        factorData[contribution.factor].impacts.push(Math.abs(contribution.weightedAdjustment));
      }
    });
  });

  // Calculate statistics
  return Object.entries(factorData).map(([factor, data]) => ({
    factor,
    averageImpact: data.impacts.length > 0 ? 
      data.impacts.reduce((sum, impact) => sum + impact, 0) / data.impacts.length : 0,
    maxImpact: data.impacts.length > 0 ? Math.max(...data.impacts) : 0,
    frequency: data.impacts.filter(impact => impact > 0.01).length / data.impacts.length,
    category: data.category
  }));
};

const analyzeWeightEffectiveness = (
  factorStats: any[],
  currentWeights: NormalizationWeights
) => {
  return factorStats.map(stat => {
    const currentWeight = getWeightForFactor(stat.factor, currentWeights);
    const suggestedWeight = calculateOptimalWeight(stat);
    const improvement = Math.abs(suggestedWeight - currentWeight) / currentWeight;

    return {
      factor: stat.factor,
      currentWeight,
      suggestedWeight,
      reasoning: generateWeightReasoning(stat, currentWeight, suggestedWeight),
      improvement
    };
  });
};

const calculateFactorCorrelations = (contributionHistory: FactorContribution[][]) => {
  const correlations: any[] = [];
  const factors = ['postPosition', 'shoes', 'sulky', 'driver', 'distance', 'raceDistance'];

  for (let i = 0; i < factors.length; i++) {
    for (let j = i + 1; j < factors.length; j++) {
      const factor1Data = extractFactorData(contributionHistory, factors[i]);
      const factor2Data = extractFactorData(contributionHistory, factors[j]);
      
      if (factor1Data.length > 1 && factor2Data.length > 1) {
        const correlation = calculateCorrelation(factor1Data, factor2Data);
        correlations.push({
          factor1: factors[i],
          factor2: factors[j],
          correlation,
          significance: getCorrelationSignificance(Math.abs(correlation))
        });
      }
    }
  }

  return correlations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
};

const getWeightForFactor = (factor: string, weights: NormalizationWeights): number => {
  const weightMap: Record<string, keyof NormalizationWeights> = {
    postPosition: 'postPosition',
    shoes: 'shoeType',
    sulky: 'sulkyType',
    driver: 'driverPerformance',
    distance: 'distanceAdjustment',
    raceDistance: 'raceDistanceAdjustment',
    raceType: 'raceType',
    timeOfDay: 'timeOfDay',
    volteStart: 'volteStartDistancePenalty',
    startPoints: 'startPoints',
    placePercentage: 'placePercentage',
    horseWinPercentage: 'horseWinPercentage',
    earningsPerStart: 'earningsPerStart'
  };

  return weights[weightMap[factor]] || 1.0;
};

const calculateOptimalWeight = (stat: any): number => {
  // Simple heuristic: weight should be proportional to impact and frequency
  const baseWeight = 1.0;
  const impactFactor = Math.min(stat.averageImpact * 10, 2.0); // Cap at 2x
  const frequencyFactor = Math.max(stat.frequency, 0.3); // Minimum 0.3x
  
  return Math.round((baseWeight * impactFactor * frequencyFactor) * 10) / 10;
};

const generateWeightReasoning = (stat: any, current: number, suggested: number): string => {
  const change = suggested - current;
  const changePercent = Math.abs(change / current) * 100;

  if (changePercent < 10) return 'Current weight is optimal';
  
  if (change > 0) {
    return `Increase weight by ${changePercent.toFixed(0)}% - factor shows high impact (${stat.averageImpact.toFixed(3)}s avg)`;
  } else {
    return `Decrease weight by ${changePercent.toFixed(0)}% - factor shows low impact (${stat.averageImpact.toFixed(3)}s avg)`;
  }
};

const extractFactorData = (contributionHistory: FactorContribution[][], factor: string): number[] => {
  return contributionHistory.map(contributions => {
    const contribution = contributions.find(c => c.factor === factor);
    return contribution ? contribution.weightedAdjustment : 0;
  });
};

const calculateCorrelation = (data1: number[], data2: number[]): number => {
  const n = Math.min(data1.length, data2.length);
  if (n < 2) return 0;

  const mean1 = data1.slice(0, n).reduce((sum, val) => sum + val, 0) / n;
  const mean2 = data2.slice(0, n).reduce((sum, val) => sum + val, 0) / n;

  let numerator = 0;
  let sum1Sq = 0;
  let sum2Sq = 0;

  for (let i = 0; i < n; i++) {
    const diff1 = data1[i] - mean1;
    const diff2 = data2[i] - mean2;
    numerator += diff1 * diff2;
    sum1Sq += diff1 * diff1;
    sum2Sq += diff2 * diff2;
  }

  const denominator = Math.sqrt(sum1Sq * sum2Sq);
  return denominator === 0 ? 0 : numerator / denominator;
};

const getCorrelationSignificance = (absCorrelation: number): 'low' | 'medium' | 'high' => {
  if (absCorrelation >= 0.7) return 'high';
  if (absCorrelation >= 0.4) return 'medium';
  return 'low';
};