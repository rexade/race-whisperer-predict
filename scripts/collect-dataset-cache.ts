import * as fs from 'fs';
import * as path from 'path';

export const COLLECT_CACHE_SCHEMA_VERSION = 1;

export interface CollectedDate<TRace = unknown> {
  date: string;
  races: TRace[];
}

interface CollectedDateCache<TRace = unknown> extends CollectedDate<TRace> {
  schemaVersion: number;
}

export type CollectorCacheInspection<TRace = unknown> =
  | { valid: true; entry: CollectedDateCache<TRace> }
  | { valid: false; reason: string };

export function inspectCollectorCacheFile<TRace = unknown>(
  filePath: string,
  expectedDate = path.basename(filePath, '.json')
): CollectorCacheInspection<TRace> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (error) {
    return {
      valid: false,
      reason: `invalid JSON (${error instanceof Error ? error.message : String(error)})`,
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, reason: 'entry is not an object' };
  }

  const entry = parsed as Partial<CollectedDateCache<TRace>>;
  if (entry.schemaVersion !== COLLECT_CACHE_SCHEMA_VERSION) {
    const actual = entry.schemaVersion === undefined ? 'missing' : String(entry.schemaVersion);
    return {
      valid: false,
      reason: `schema ${actual}; expected ${COLLECT_CACHE_SCHEMA_VERSION}`,
    };
  }
  if (entry.date !== expectedDate) {
    return { valid: false, reason: `date ${String(entry.date)} does not match ${expectedDate}` };
  }
  if (!Array.isArray(entry.races)) {
    return { valid: false, reason: 'races is not an array' };
  }

  return { valid: true, entry: entry as CollectedDateCache<TRace> };
}

export function writeCollectorCacheFile<TRace>(
  filePath: string,
  entry: CollectedDate<TRace>
): void {
  const cached: CollectedDateCache<TRace> = {
    schemaVersion: COLLECT_CACHE_SCHEMA_VERSION,
    date: entry.date,
    races: entry.races,
  };
  fs.writeFileSync(filePath, JSON.stringify(cached));
}

export function assembleCollectorCache<TRace>(
  cacheDir: string,
  outPath: string
): { dateCount: number; raceCount: number } {
  const files = fs.readdirSync(cacheDir)
    .filter(file => /^\d{4}-\d{2}-\d{2}\.json$/.test(file))
    .sort();
  const dataset: Array<CollectedDate<TRace>> = [];
  const invalid: string[] = [];

  for (const file of files) {
    const filePath = path.join(cacheDir, file);
    const inspection = inspectCollectorCacheFile<TRace>(filePath);
    if (!inspection.valid) {
      invalid.push(`${file} (${inspection.reason})`);
      continue;
    }
    if (inspection.entry.races.length > 0) {
      dataset.push({ date: inspection.entry.date, races: inspection.entry.races });
    }
  }

  if (invalid.length > 0) {
    throw new Error(
      `Cannot assemble collector cache: ${invalid.join(', ')}. `
      + 'Re-run collection without --assemble-only to recollect these dates.'
    );
  }

  const raceCount = dataset.reduce((sum, date) => sum + date.races.length, 0);
  fs.writeFileSync(outPath, JSON.stringify(dataset));
  return { dateCount: dataset.length, raceCount };
}
