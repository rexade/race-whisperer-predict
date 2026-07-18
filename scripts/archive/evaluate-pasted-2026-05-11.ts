import { loadDataset } from '../cli-common';
import { evaluateWeights } from '../src/services/calibration/historicalCalibrationService';

const weights = {
  form: 0.222,
  oddsLive: 0.000,
  shoeType: 0.000,
  ageFactor: 0.000,
  sulkyType: 0.537,
  driverForm: 0.025,
  gallopRisk: 0.052,
  startPoints: 2.521,
  postPosition: 2.439,
  layoffPenalty: 2.944,
  oddsHistorical: 0.000,
  driverEmpirical: 4.810,
  placePercentage: 0.000,
  earningsPerStart: 0.872,
  genderAdjustment: 0.550,
  trackFamiliarity: 0.000,
  consistencyFactor: 0.740,
  driverPerformance: 3.764,
  distanceAdjustment: 0.000,
  horseWinPercentage: 1.051,
  trainerPerformance: 0.200,
  raceDistanceAdjustment: 0.785,
  volteStartDistancePenalty: 1.126,
};

const postPositionCurves = {
  auto: {
    1: -0.114, 2: 0.014, 3: -0.176, 4: -0.099, 5: 0.019,
    6: 0.063, 7: 0.169, 8: 0.272, 9: 0.992, 10: 0.537,
    11: 0.464, 12: 0.838, 13: 1.033, 14: 0.551, 15: 1.047,
  },
  volte: {
    1: -0.658, 2: 0.054, 3: 0.014, 4: 0.180, 5: 0.221,
    6: 0.336, 7: 0.454, 8: -0.009, 9: 0.722, 10: 0.430,
    11: 0.682, 12: 0.992, 13: 1.357, 14: 0.994, 15: 0.862,
  },
  byDistance: {
    auto: {
      short: {
        1: -0.114, 2: 0.014, 3: -0.226, 4: -0.099, 5: 0.019,
        6: 0.063, 7: 0.219, 8: 0.272, 9: 0.992, 10: 0.537,
        11: 0.464, 12: 0.838, 13: 1.033, 14: 0.551, 15: 1.047,
      },
      medium: {
        1: -0.114, 2: 0.014, 3: -0.176, 4: -0.099, 5: 0.019,
        6: 0.063, 7: 0.169, 8: 0.272, 9: 0.967, 10: 0.537,
        11: 0.464, 12: 0.788, 13: 1.033, 14: 0.551, 15: 1.047,
      },
      long: {
        1: -0.114, 2: 0.014, 3: -0.176, 4: -0.099, 5: 0.069,
        6: 0.013, 7: 0.169, 8: 0.272, 9: 0.967, 10: 0.537,
        11: 0.489, 12: 0.838, 13: 1.033, 14: 0.551, 15: 1.047,
      },
    },
    volte: {
      short: {
        1: -0.658, 2: 0.054, 3: 0.014, 4: 0.180, 5: 0.221,
        6: 0.336, 7: 0.404, 8: -0.009, 9: 0.722, 10: 0.430,
        11: 0.682, 12: 0.992, 13: 1.357, 14: 0.994, 15: 0.862,
      },
      medium: {
        1: -0.658, 2: 0.054, 3: 0.014, 4: 0.180, 5: 0.171,
        6: 0.336, 7: 0.454, 8: -0.009, 9: 0.722, 10: 0.430,
        11: 0.632, 12: 1.042, 13: 1.357, 14: 0.994, 15: 0.862,
      },
      long: {
        1: -0.658, 2: 0.104, 3: 0.014, 4: 0.180, 5: 0.221,
        6: 0.336, 7: 0.454, 8: -0.009, 9: 0.722, 10: 0.430,
        11: 0.682, 12: 0.992, 13: 1.357, 14: 0.994, 15: 0.862,
      },
    },
  },
};

async function main() {
  const datasetPath = process.argv[2] || 'calibration-dataset-6mo_latest.json';
  const dataset = loadDataset(datasetPath);
  const result = await evaluateWeights(dataset, weights as any, postPositionCurves as any);
  console.log(JSON.stringify({
    datasetPath,
    dates: dataset.length,
    races: result.racesEvaluated,
    win: result.winAccuracy,
    winnerMRR: result.winnerMRR,
    winnerTop3: result.winnerTop3Accuracy,
    winnerTop5: result.winnerTop5Accuracy,
    topPickTop3: result.topPickAccuracy,
    horsesEvaluated: result.horsesEvaluated,
    estimatedHorsesSkipped: result.estimatedHorsesSkipped,
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
