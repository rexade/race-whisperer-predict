/**
 * Live prediction CLI — rank a game day's races with any preset, no browser needed.
 *
 * Runs the exact production pipeline: fetchRaceDataForGame (incl. game-pool
 * merge → liveOdds/betDistribution/shoe-change flags), per-horse km-time
 * history, and RaceResultProcessor with the chosen preset's weights + curves.
 * Driver empirical ratings are bootstrapped from the local calibration dataset.
 *
 * Usage:
 *   npx tsx scripts/predict.ts [--date YYYY-MM-DD] [--type V85] [--preset V41] [--dataset calibration-dataset-full.json]
 */

import './node-polyfills';
import * as fs from 'fs';

const ATG_BASE = 'https://www.atg.se/services/racinginfo/v1/api';
const realFetch = globalThis.fetch.bind(globalThis);
(globalThis as any).fetch = (input: any, init?: any) => {
  if (typeof input === 'string' && input.startsWith('/api/atg/')) {
    input = ATG_BASE + input.slice('/api/atg'.length);
  }
  return realFetch(input, init);
};

import { fetchV75GameInfo, fetchRaceDataForGame } from '../src/services/v75CalendarApi';
import { RaceResultProcessor } from '../src/components/v75/services/raceResultProcessor';
import { calculateRawKmTimesForRaceWithId } from '../src/services/kmTimeProcessor';
import { WEIGHT_PRESETS } from '../src/services/modernKm/presetWeights';
import { computeDriverRatings, saveDriverRatings } from '../src/services/calibration/driverRatingService';
import { hydrateDataset } from './cli-common';
import type { GameType } from '../src/config/game';

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const date = argValue('--date') ?? new Date().toISOString().split('T')[0];
  const type = (argValue('--type') ?? 'V85') as GameType;
  const presetKey = (argValue('--preset') ?? 'V41').toLowerCase();
  const datasetPath = argValue('--dataset') ?? 'calibration-dataset-full.json';

  const preset = WEIGHT_PRESETS.find(p => p.name.toLowerCase().startsWith(presetKey));
  if (!preset) {
    console.error(`Preset "${presetKey}" not found. Available: ${WEIGHT_PRESETS.map(p => p.name.split(' ')[0]).join(', ')}`);
    process.exit(1);
  }

  // Bootstrap driver empirical ratings (driverEmpirical is a top factor)
  if (fs.existsSync(datasetPath)) {
    const dataset = hydrateDataset(JSON.parse(fs.readFileSync(datasetPath, 'utf-8')));
    const ratings = computeDriverRatings(dataset);
    saveDriverRatings(ratings);
    console.log(`Driver ratings: ${ratings.size} drivers from ${datasetPath}`);
  } else {
    console.warn(`⚠ No dataset at ${datasetPath} — driverEmpirical factor will be inactive!`);
  }

  const gameInfo = await fetchV75GameInfo(date, type);
  if (!gameInfo) {
    console.error(`No ${type} game on ${date}`);
    process.exit(1);
  }
  console.log(`\n${type} ${date} — game ${gameInfo.gameId} — preset: ${preset.name}\n`);

  const races = await fetchRaceDataForGame(date, gameInfo, type);

  for (const race of races) {
    const rawKmTimes = await calculateRawKmTimesForRaceWithId(
      race.raceId,
      race.horses.map((horse: any) => ({
        horseKey: horse.horseKey,
        horse: { id: horse.horseId, name: typeof horse.name === 'string' ? horse.name : String(horse.name) },
        number: horse.postPosition,
        postPosition: horse.postPosition,
        distance: horse.distance,
        driver: {
          firstName: horse.driver.firstName,
          lastName: horse.driver.lastName,
          statistics: { winPercentage: horse.driver.winPercentage },
        },
      })) as any,
      undefined,
      date
    );

    const result = await RaceResultProcessor.processRaceResult(
      race, rawKmTimes, preset.weights, undefined, preset.postPositionCurves
    );
    if (!result.analysisComplete) {
      console.log(`Race ${race.raceNumber}: analysis failed\n`);
      continue;
    }

    console.log(`── Race ${race.raceNumber} · ${race.distance}m ${race.startMethod} · ${race.name ?? ''} ──`);
    const ranked = [...result.horses].sort((a: any, b: any) => (a.rank ?? 99) - (b.rank ?? 99));
    for (const h of ranked) {
      const src = race.horses.find((x: any) => x.horseKey === (h as any).horseKey) as any;
      const t = (h as any).modernNormalizedResult?.modernNormalizedTime;
      const time = t ? `${t.minutes}:${String(t.seconds).padStart(2, '0')}.${t.tenths}` : '  —  ';
      const odds = src?.liveOdds != null ? String(src.liveOdds).padStart(6) : '     ?';
      const dist = src?.betDistribution != null ? `${src.betDistribution.toFixed(1)}%`.padStart(6) : '     ?';
      const shoe = (src?.shoes?.frontChanged || src?.shoes?.backChanged)
        ? (src.shoes.front === false || src.shoes.back === false ? ' 🥾→🦶' : ' 🦶→🥾')
        : '';
      const est = (h as any).modernNormalizedResult?.isEstimated ? ' (est)' : '';
      console.log(`  ${String((h as any).rank).padStart(2)}. #${String(src?.postPosition ?? '?').padStart(2)} ${String((h as any).horseName ?? src?.name ?? '?').padEnd(24)} ${time}  odds${odds}  spel${dist}${shoe}${est}`);
    }
    console.log('');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
