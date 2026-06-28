import fs from 'fs';
import { loadDataset } from './cli-common';

type Options = {
  datasetPath: string;
  baseUrl: string;
  outPath: string;
  store: boolean;
  includeRaw: boolean;
};

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const datasetPath = args[0] ?? 'calibration-dataset-6mo5_11.json';
  const get = (name: string, fallback: string) => {
    const prefix = `${name}=`;
    return args.find(arg => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback;
  };
  return {
    datasetPath,
    baseUrl: get('--base-url', 'http://127.0.0.1:8092').replace(/\/$/, ''),
    outPath: get('--out', 'reports/rawtime-candidates-6mo5_11.json'),
    store: args.includes('--store'),
    includeRaw: args.includes('--include-raw'),
  };
}

async function fetchJson(url: string) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}: ${url}`);
  return resp.json();
}

async function postJson(url: string, body: unknown) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}: ${url}`);
}

async function main() {
  const options = parseArgs();
  const dataset = loadDataset(options.datasetPath);
  const out: any = {
    exportedAt: new Date().toISOString(),
    sourceDataset: options.datasetPath,
    baseUrl: options.baseUrl,
    schemaVersion: 1,
    dates: {},
  };

  let raceCount = 0;
  for (const dateEntry of dataset as any[]) {
    const races = [];
    for (const race of dateEntry.races ?? []) {
      raceCount++;
      const url = `${options.baseUrl}/api/debug/races/${race.raceId}/rawtimes-unfiltered${options.includeRaw ? '?includeRaw=true' : ''}`;
      const candidateData = await fetchJson(url);
      races.push({
        raceId: race.raceId,
        raceNumber: race.raceNumber,
        candidateData,
      });

      if (options.store) {
        await postJson(`${options.baseUrl}/api/rawtime-candidates`, {
          date: dateEntry.date,
          gameId: dateEntry.gameId ?? `v75-${dateEntry.date}`,
          raceId: race.raceId,
          raceNumber: race.raceNumber,
          candidateData,
          schemaVersion: 1,
        });
      }

      const horseCount = candidateData.horses?.length ?? 0;
      const recordCount = (candidateData.horses ?? []).reduce((sum: number, h: any) => sum + (h.recordCount ?? 0), 0);
      console.log(`${dateEntry.date} R${race.raceNumber} ${race.raceId}: ${horseCount} horses, ${recordCount} candidates`);
    }
    out.dates[dateEntry.date] = {
      gameId: dateEntry.gameId ?? `v75-${dateEntry.date}`,
      races,
    };
  }

  fs.mkdirSync(options.outPath.replace(/\/[^/]+$/, ''), { recursive: true });
  fs.writeFileSync(options.outPath, JSON.stringify(out, null, 2));
  console.log(`Saved ${options.outPath} (${raceCount} races)${options.store ? ' and stored in DB' : ''}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
