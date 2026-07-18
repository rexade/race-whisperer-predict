import { loadDataset } from '../cli-common';
import { evaluateWeights } from '../src/services/calibration/historicalCalibrationService';

const weights = {
  form: 2.810,
  oddsLive: 0.000,
  shoeType: 0.000,
  ageFactor: 0.000,
  sulkyType: 0.000,
  driverForm: 1.680,
  gallopRisk: 0.196,
  startPoints: 0.267,
  postPosition: 2.159,
  layoffPenalty: 1.261,
  oddsHistorical: 2.381,
  driverEmpirical: 4.255,
  placePercentage: 0.564,
  earningsPerStart: 1.804,
  genderAdjustment: 0.000,
  trackFamiliarity: 0.000,
  consistencyFactor: 1.489,
  driverPerformance: 0.436,
  distanceAdjustment: 1.055,
  horseWinPercentage: 1.148,
  trainerPerformance: 0.000,
  raceDistanceAdjustment: 0.555,
  volteStartDistancePenalty: 1.459,
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
        1: 0.036, 2: 0.014, 3: -0.226, 4: -0.099, 5: 0.019,
        6: 0.063, 7: 0.219, 8: 0.272, 9: 1.042, 10: 0.537,
        11: 0.464, 12: 0.738, 13: 1.033, 14: 0.551, 15: 1.047,
      },
      medium: {
        1: -0.064, 2: 0.014, 3: -0.176, 4: -0.099, 5: 0.019,
        6: 0.063, 7: 0.219, 8: 0.247, 9: 0.792, 10: 0.287,
        11: 0.414, 12: 0.888, 13: 1.058, 14: 0.501, 15: 1.047,
      },
      long: {
        1: -0.064, 2: 0.064, 3: -0.176, 4: -0.099, 5: 0.169,
        6: -0.012, 7: 0.169, 8: 0.322, 9: 0.967, 10: 0.537,
        11: 0.489, 12: 0.888, 13: 1.033, 14: 0.501, 15: 1.047,
      },
    },
    volte: {
      short: {
        1: -0.658, 2: 0.054, 3: 0.014, 4: 0.180, 5: 0.221,
        6: 0.386, 7: 0.454, 8: -0.009, 9: 0.722, 10: 0.430,
        11: 0.682, 12: 0.992, 13: 1.357, 14: 0.994, 15: 0.862,
      },
      medium: {
        1: -0.558, 2: 0.104, 3: 0.014, 4: 0.330, 5: 0.221,
        6: 0.361, 7: 0.454, 8: -0.009, 9: 0.722, 10: 0.430,
        11: 0.682, 12: 0.992, 13: 1.357, 14: 0.994, 15: 0.862,
      },
      long: {
        1: -0.658, 2: 0.054, 3: 0.164, 4: 0.230, 5: 0.221,
        6: 0.236, 7: 0.454, 8: -0.009, 9: 0.672, 10: 0.430,
        11: 0.682, 12: 0.992, 13: 1.357, 14: 0.994, 15: 0.862,
      },
    },
  },
};

async function main() {
  const datasetPath = process.argv[2] || 'calibration-dataset-6mo5_11.json';
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
