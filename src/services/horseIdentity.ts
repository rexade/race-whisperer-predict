export type HorseIdentityKey = string;

function normalizeRealHorseId(horseId: unknown): string | null {
  if (typeof horseId === 'number' && Number.isFinite(horseId) && horseId > 0) {
    return String(horseId);
  }
  if (typeof horseId === 'string' && /^\d+$/.test(horseId) && Number(horseId) > 0) {
    return horseId;
  }
  return null;
}

export function makeHorseKey(
  raceId: string,
  horseId: unknown,
  startNumber?: unknown
): HorseIdentityKey {
  const realHorseId = normalizeRealHorseId(horseId);
  if (realHorseId) return realHorseId;

  const start = typeof startNumber === 'number' || typeof startNumber === 'string'
    ? String(startNumber)
    : 'unknown';
  return `${raceId}:start:${start}`;
}

export function horseKeyFromRaceHorse(raceId: string, horse: any): HorseIdentityKey {
  return horse?.horseKey ?? makeHorseKey(raceId, horse?.horseId ?? horse?.id, horse?.postPosition ?? horse?.number);
}

export function horseKeyFromRawTime(rawTime: { horseKey?: string; horseId: number }): HorseIdentityKey {
  return rawTime.horseKey ?? String(rawTime.horseId);
}
