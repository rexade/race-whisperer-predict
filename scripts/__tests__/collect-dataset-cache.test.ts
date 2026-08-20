// @vitest-environment node
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  assembleCollectorCache,
  COLLECT_CACHE_SCHEMA_VERSION,
  inspectCollectorCacheFile,
  writeCollectorCacheFile,
} from '../collect-dataset-cache';

let tempDir: string;
let outputPath: string;

describe('collector per-date cache schema', () => {
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'race-whisperer-collector-'));
    outputPath = path.join(tempDir, 'dataset.json');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('rejects legacy unversioned shards during assembly', () => {
    const cachePath = path.join(tempDir, '2026-08-01.json');
    fs.writeFileSync(cachePath, JSON.stringify({ date: '2026-08-01', races: [] }));

    expect(inspectCollectorCacheFile(cachePath)).toEqual({
      valid: false,
      reason: `schema missing; expected ${COLLECT_CACHE_SCHEMA_VERSION}`,
    });
    expect(() => assembleCollectorCache(tempDir, outputPath)).toThrow(
      /Re-run collection without --assemble-only to recollect these dates/
    );
    expect(fs.existsSync(outputPath)).toBe(false);
  });

  it('overwrites stale shards with the current schema and strips it from final output', () => {
    const cachePath = path.join(tempDir, '2026-08-01.json');
    fs.writeFileSync(cachePath, JSON.stringify({ date: '2026-08-01', races: [] }));

    writeCollectorCacheFile(cachePath, {
      date: '2026-08-01',
      races: [{ raceId: 'race-1' }],
    });

    expect(inspectCollectorCacheFile(cachePath).valid).toBe(true);
    expect(assembleCollectorCache(tempDir, outputPath)).toEqual({ dateCount: 1, raceCount: 1 });
    expect(JSON.parse(fs.readFileSync(outputPath, 'utf-8'))).toEqual([{
      date: '2026-08-01',
      races: [{ raceId: 'race-1' }],
    }]);
  });
});
