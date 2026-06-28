import './cli-common';
import fs from 'fs';
import { calculateRawKmTimesForRaceWithId } from '../src/services/kmTimeProcessor';

const API_BASE = process.env.API_BASE ?? 'http://127.0.0.1:8092';
const datasetPath = process.argv[2] ?? 'calibration-dataset-6mo5_11.json';
const raceId = process.argv[3] ?? '2026-05-09_6_5';

const realFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = ((input: any, init?: any) => {
  const url = typeof input === 'string' && input.startsWith('/api/')
    ? `${API_BASE}${input}`
    : input;
  return realFetch(url, init);
}) as typeof fetch;

function sec(t: any): number | null {
  if (!t || typeof t.minutes !== 'number') return null;
  return t.minutes * 60 + t.seconds + (t.tenths ?? 0) / 10;
}

async function main() {
  const raw = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
  const dataset = Array.isArray(raw) ? raw : raw.dataset;
  const dateEntry = dataset.find((d: any) => d.races?.some((r: any) => r.raceId === raceId));
  const race = dateEntry?.races.find((r: any) => r.raceId === raceId);
  if (!race) throw new Error(`Race not found: ${raceId}`);

  const starts = race.raceData.horses.map((horse: any) => ({
    horseKey: horse.horseKey,
    horse: { id: horse.horseId, name: String(horse.name) },
    number: horse.postPosition,
    postPosition: horse.postPosition,
    distance: horse.distance,
    driver: {
      firstName: horse.driver?.firstName ?? '',
      lastName: horse.driver?.lastName ?? '',
      statistics: { winPercentage: horse.driver?.winPercentage ?? 0 },
    },
  }));

  const rebuilt = await calculateRawKmTimesForRaceWithId(raceId, starts, undefined, dateEntry.date);
  const storedByKey = new Map(race.rawKmTimes.map((rt: any) => [rt.horseKey ?? String(rt.horseId), rt]));

  const rows = rebuilt.map(rt => {
    const stored: any = storedByKey.get(rt.horseKey ?? String(rt.horseId));
    return {
      horse: rt.horseName,
      stored: sec(stored?.rawBestTime ?? stored?.bestTime),
      rebuilt: sec(rt.rawBestTime ?? rt.bestTime),
      storedValid: stored?.validTimesCount,
      rebuiltValid: rt.validTimesCount,
      storedLast: stored?.lastRaceDate,
      rebuiltLast: rt.lastRaceDate,
    };
  });

  console.table(rows);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
