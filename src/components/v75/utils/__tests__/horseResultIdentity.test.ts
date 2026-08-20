// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { horseResultDomId, horseResultKey } from '../horseResultIdentity';

const zeroIdHorse = (startNumber: number) => ({
  raceId: '2026-08-20_86_5',
  horseId: 0,
  startNumber,
  postPosition: 1,
});

describe('horse result identity', () => {
  it('separates zero-ID starters and produces selector-safe DOM ids', () => {
    const first = zeroIdHorse(3);
    const second = zeroIdHorse(7);

    expect(horseResultKey(first)).not.toBe(horseResultKey(second));
    expect(horseResultDomId(first)).not.toBe(horseResultDomId(second));
    expect(horseResultDomId(first)).toMatch(/^[A-Za-z][A-Za-z0-9_-]*$/);
    expect(horseResultDomId(second)).toMatch(/^[A-Za-z][A-Za-z0-9_-]*$/);
  });
});
