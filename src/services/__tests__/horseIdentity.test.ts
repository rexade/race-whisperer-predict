import { describe, expect, it } from 'vitest';
import { horseKeyFromRaceHorse, horseKeyFromRawTime, makeHorseKey } from '../horseIdentity';

describe('horse identity keys', () => {
  it('uses the real horse id when ATG provides one', () => {
    expect(makeHorseKey('2026-04-04_85_5', 12345, 2)).toBe('12345');
  });

  it('uses race id and start number when ATG horse id is missing', () => {
    expect(makeHorseKey('2026-04-04_85_5', 0, 2)).toBe('2026-04-04_85_5:start:2');
    expect(makeHorseKey('2026-04-04_85_5', null, 3)).toBe('2026-04-04_85_5:start:3');
  });

  it('keeps race horses and raw times matchable with synthetic keys', () => {
    const raceHorse = { horseId: 0, startNumber: 7, postPosition: 2 };
    const rawTime = { horseKey: '2026-04-04_85_5:start:7', horseId: 0 };

    expect(horseKeyFromRaceHorse('2026-04-04_85_5', raceHorse)).toBe(horseKeyFromRawTime(rawTime));
  });
});
