import { DEFAULT_WEIGHTS, type NormalizationWeights } from './types';

export const NORMALIZATION_WEIGHT_MIN = 0;
export const NORMALIZATION_WEIGHT_MAX = 10;

const weightKeys = Object.keys(DEFAULT_WEIGHTS) as (keyof NormalizationWeights)[];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Validate supplied coefficients and backfill factors added after they were saved. */
export function parseNormalizationWeights(value: unknown): NormalizationWeights | null {
  if (!isRecord(value)) return null;

  const parsed = { ...DEFAULT_WEIGHTS };
  let suppliedWeightCount = 0;

  for (const key of weightKeys) {
    if (!(key in value)) continue;
    const candidate = value[key];
    if (
      typeof candidate !== 'number'
      || !Number.isFinite(candidate)
      || candidate < NORMALIZATION_WEIGHT_MIN
      || candidate > NORMALIZATION_WEIGHT_MAX
    ) {
      return null;
    }
    parsed[key] = candidate;
    suppliedWeightCount++;
  }

  return suppliedWeightCount > 0 ? parsed : null;
}

export function loadBrowserDefaultWeights(): NormalizationWeights | null {
  if (typeof localStorage === 'undefined') return null;

  try {
    const stored = localStorage.getItem('customDefaultWeights');
    return stored ? parseNormalizationWeights(JSON.parse(stored)) : null;
  } catch {
    return null;
  }
}
