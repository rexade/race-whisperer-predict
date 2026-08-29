// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_WEIGHTS } from '../types';
import {
  loadBrowserDefaultWeights,
  NORMALIZATION_WEIGHT_MAX,
  parseNormalizationWeights,
} from '../weightConfig';

describe('weight configuration', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllEnvs());

  it('merges an older partial configuration with current defaults', () => {
    expect(parseNormalizationWeights({ postPosition: 1.25 })).toEqual({
      ...DEFAULT_WEIGHTS,
      postPosition: 1.25,
    });
  });

  it('rejects malformed and out-of-range coefficients', () => {
    expect(parseNormalizationWeights({ oddsLive: '2' })).toBeNull();
    expect(parseNormalizationWeights({ oddsLive: Number.NaN })).toBeNull();
    expect(parseNormalizationWeights({ oddsLive: NORMALIZATION_WEIGHT_MAX + 1 })).toBeNull();
    expect(parseNormalizationWeights({ unknown: 1 })).toBeNull();
  });

  it('loads validated browser defaults', () => {
    localStorage.setItem('customDefaultWeights', JSON.stringify({ oddsLive: 2 }));
    expect(loadBrowserDefaultWeights()).toEqual({ ...DEFAULT_WEIGHTS, oddsLive: 2 });
  });

  it('ignores invalid browser storage', () => {
    localStorage.setItem('customDefaultWeights', '{broken');
    expect(loadBrowserDefaultWeights()).toBeNull();
  });

  it('uses browser defaults at startup when persistence is disabled', async () => {
    localStorage.setItem('customDefaultWeights', JSON.stringify({ oddsLive: 2 }));
    vi.stubEnv('VITE_PERSISTENCE_API_ENABLED', 'false');
    vi.resetModules();

    const { initWeightsFromApi } = await import('../index');

    await expect(initWeightsFromApi()).resolves.toEqual({
      weights: { ...DEFAULT_WEIGHTS, oddsLive: 2 },
    });
  });
});
