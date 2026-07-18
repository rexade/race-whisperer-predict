import { loadDataset } from '../cli-common';
import { evaluateWeights } from '../src/services/calibration/historicalCalibrationService';

const weights = {
  form: 2.610, oddsLive: 0, shoeType: 0, ageFactor: 0, sulkyType: 0,
  driverForm: 1.480, gallopRisk: 0.109, startPoints: 0.267, postPosition: 2.159,
  layoffPenalty: 1.461, oddsHistorical: 2.381, driverEmpirical: 4.055,
  placePercentage: 0, earningsPerStart: 1.479, genderAdjustment: 0,
  trackFamiliarity: 0, consistencyFactor: 1.489, driverPerformance: 0.509,
  distanceAdjustment: 0, horseWinPercentage: 1.148, trainerPerformance: 0,
  raceDistanceAdjustment: 0.555, volteStartDistancePenalty: 1.059,
};

const postPositionCurves = {
  auto: { 1: -0.114, 2: 0.014, 3: -0.176, 4: -0.099, 5: 0.019, 6: 0.063, 7: 0.169, 8: 0.272, 9: 0.992, 10: 0.537, 11: 0.464, 12: 0.838, 13: 1.033, 14: 0.551, 15: 1.047 },
  volte: { 1: -0.658, 2: 0.054, 3: 0.014, 4: 0.180, 5: 0.221, 6: 0.336, 7: 0.454, 8: -0.009, 9: 0.722, 10: 0.430, 11: 0.682, 12: 0.992, 13: 1.357, 14: 0.994, 15: 0.862 },
  byDistance: {
    auto: {
      short: { 1: -0.164, 2: 0.164, 3: -0.176, 4: 0.001, 5: -0.081, 6: 0.113, 7: 0.219, 8: 0.322, 9: 1.092, 10: 0.537, 11: 0.414, 12: 0.637, 13: 1.033, 14: 0.551, 15: 1.047 },
      medium: { 1: 0.286, 2: -0.149, 3: -0.101, 4: -0.174, 5: 0.019, 6: 0.051, 7: 0.219, 8: 0.247, 9: 0.817, 10: 0.237, 11: 0.414, 12: 0.775, 13: 1.108, 14: 0.501, 15: 1.047 },
      long: { 1: -0.114, 2: 0.114, 3: -0.076, 4: -0.099, 5: 0.169, 6: 0.038, 7: 0.169, 8: 0.322, 9: 0.879, 10: 0.587, 11: 0.539, 12: 0.788, 13: 1.033, 14: 0.451, 15: 0.947 },
    },
    volte: {
      short: { 1: -0.658, 2: 0.104, 3: 0.014, 4: 0.180, 5: 0.221, 6: 0.386, 7: 0.454, 8: -0.009, 9: 0.722, 10: 0.430, 11: 0.732, 12: 0.992, 13: 1.357, 14: 0.994, 15: 0.862 },
      medium: { 1: -0.558, 2: 0.254, 3: 0.014, 4: 0.330, 5: 0.271, 6: 0.511, 7: 0.554, 8: -0.009, 9: 0.622, 10: 0.467, 11: 0.670, 12: 0.942, 13: 1.457, 14: 1.044, 15: 0.811 },
      long: { 1: -0.708, 2: 0.054, 3: 0.164, 4: 0.280, 5: 0.221, 6: 0.086, 7: 0.454, 8: -0.009, 9: 0.722, 10: 0.430, 11: 0.782, 12: 0.942, 13: 1.357, 14: 1.044, 15: 0.862 },
    },
  },
};

async function main() {
  const datasetPath = process.argv[2] || 'calibration-dataset-6mo_lat_5_11_3.json';
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
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
