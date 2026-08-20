// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RAW_TIMES_SCHEMA_VERSION, RawTimesCache } from '../rawTimesCache';

vi.mock('@/lib/logger', () => ({
  log: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

const response = (data: unknown, ok = true) => ({
  ok,
  status: ok ? 200 : 500,
  json: vi.fn().mockResolvedValue(data),
});

describe('RawTimesCache schema', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([undefined, 6])('treats schema %s as a cache miss', async schemaVersion => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({
      raceId: 'race-1',
      raceNumber: 1,
      rawTimes: [],
      schemaVersion,
    })));

    await expect(RawTimesCache.getRawTimes('race-1')).resolves.toBeNull();
  });

  it('accepts the current schema', async () => {
    const current = {
      raceId: 'race-1',
      raceNumber: 1,
      rawTimes: [],
      schemaVersion: RAW_TIMES_SCHEMA_VERSION,
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(current)));

    await expect(RawTimesCache.getRawTimes('race-1')).resolves.toBe(current);
  });

  it('writes the current schema version', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(null));
    vi.stubGlobal('fetch', fetchMock);

    await RawTimesCache.storeRawTimes('2026-08-20', 'game-1', 'race-1', 1, []);

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(request.body)).schemaVersion).toBe(RAW_TIMES_SCHEMA_VERSION);
  });
});
