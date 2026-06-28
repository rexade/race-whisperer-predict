import { loadDataset } from './cli-common';
import { evaluateWeights } from '../src/services/calibration/historicalCalibrationService';

export const weights = {
  form: 0.210861,
  oddsLive: 0.000000,
  shoeType: 0.000000,
  ageFactor: 0.000000,
  sulkyType: 0.926739,
  driverForm: 0.345692,
  gallopRisk: 0.000000,
  startPoints: 2.983169,
  postPosition: 2.247678,
  layoffPenalty: 3.502668,
  oddsHistorical: 0.000000,
  driverEmpirical: 4.607057,
  placePercentage: 1.002863,
  earningsPerStart: 1.202785,
  genderAdjustment: 1.877249,
  trackFamiliarity: 0.000000,
  consistencyFactor: 2.434322,
  driverPerformance: 0.000000,
  distanceAdjustment: 0.000000,
  horseWinPercentage: 1.237797,
  trainerPerformance: 4.613088,
  raceDistanceAdjustment: 0.183235,
  volteStartDistancePenalty: 1.445544,
};

export const postPositionCurves = {
  auto: {
    1: -0.113500, 2: -0.036000, 3: -0.126000, 4: -0.174000, 5: -0.081000,
    6: 0.188000, 7: 0.319000, 8: 0.322000, 9: 0.979500, 10: 0.687000,
    11: 0.352000, 12: 0.850000, 13: 1.083000, 14: 0.751000, 15: 1.147000,
  },
  volte: {
    1: -0.658000, 2: 0.216000, 3: 0.064000, 4: 0.317500, 5: 0.296000,
    6: 0.186000, 7: 0.404000, 8: 0.091000, 9: 0.772000, 10: 0.480000,
    11: 0.582000, 12: 0.742000, 13: 1.307000, 14: 0.956500, 15: 0.799000,
  },
  byDistance: {
    auto: {
      short: {
        1: -0.113500, 2: -0.086000, 3: -0.026000, 4: -0.074000, 5: -0.081000,
        6: 0.188000, 7: 0.369000, 8: 0.272000, 9: 1.029500, 10: 0.687000,
        11: 0.302000, 12: 0.800000, 13: 1.083000, 14: 0.751000, 15: 1.147000,
      },
      medium: {
        1: -0.113500, 2: -0.011000, 3: -0.176000, 4: -0.149000, 5: -0.031000,
        6: 0.188000, 7: 0.369000, 8: 0.334500, 9: 0.867000, 10: 0.612000,
        11: 0.352000, 12: 0.925000, 13: 1.083000, 14: 0.751000, 15: 1.147000,
      },
      long: {
        1: -0.113500, 2: 0.014000, 3: -0.126000, 4: -0.024000, 5: -0.131000,
        6: 0.188000, 7: 0.419000, 8: 0.372000, 9: 0.979500, 10: 0.687000,
        11: 0.252000, 12: 0.850000, 13: 1.183000, 14: 0.751000, 15: 1.197000,
      },
    },
    volte: {
      short: {
        1: -0.658000, 2: 0.216000, 3: 0.064000, 4: 0.317500, 5: 0.296000,
        6: 0.186000, 7: 0.404000, 8: 0.091000, 9: 0.772000, 10: 0.530000,
        11: 0.582000, 12: 0.742000, 13: 1.307000, 14: 0.906500, 15: 0.799000,
      },
      medium: {
        1: -0.658000, 2: 0.216000, 3: 0.064000, 4: 0.367500, 5: 0.246000,
        6: 0.186000, 7: 0.404000, 8: 0.041000, 9: 0.822000, 10: 0.480000,
        11: 0.532000, 12: 0.742000, 13: 1.307000, 14: 0.956500, 15: 0.799000,
      },
      long: {
        1: -0.608000, 2: 0.191000, 3: 0.114000, 4: 0.367500, 5: 0.296000,
        6: 0.186000, 7: 0.404000, 8: 0.041000, 9: 0.822000, 10: 0.480000,
        11: 0.582000, 12: 0.692000, 13: 1.307000, 14: 0.956500, 15: 0.799000,
      },
    },
  },
};

async function main() {
  const paths = process.argv.slice(2);
  const datasetPaths = paths.length > 0 ? paths : ['calibration-dataset-6mo5_11.json'];

  for (const datasetPath of datasetPaths) {
    const dataset = loadDataset(datasetPath);
    const result = await evaluateWeights(dataset, weights as any, postPositionCurves as any);
    console.log(JSON.stringify({
      datasetPath,
      dates: dataset.length,
      races: result.racesEvaluated,
      winPct: +(result.winAccuracy * 100).toFixed(2),
      winnerMRR: +result.winnerMRR.toFixed(6),
      winnerTop3Pct: +(result.winnerTop3Accuracy * 100).toFixed(2),
      winnerTop5Pct: +(result.winnerTop5Accuracy * 100).toFixed(2),
      topPickTop3Pct: +(result.topPickAccuracy * 100).toFixed(2),
      rankMAE: +result.rankMAE.toFixed(4),
      winnerRankMAE: +result.winnerRankMAE.toFixed(4),
      horsesEvaluated: result.horsesEvaluated,
      estimatedHorsesSkipped: result.estimatedHorsesSkipped,
    }, null, 2));
  }
}

if (process.argv[1]?.endsWith('reproduce-user-weights-2026-05-11.ts')) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
