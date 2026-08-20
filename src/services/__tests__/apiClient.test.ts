// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { ApiRequestError, apiHeaders, assertResponseOk } from '../apiClient';

describe('apiHeaders', () => {
  beforeEach(() => localStorage.clear());

  it('returns extra headers unchanged when no token is configured', () => {
    expect(apiHeaders({ 'Content-Type': 'application/json' })).toEqual({
      'Content-Type': 'application/json',
    });
  });

  it('attaches X-Api-Token from localStorage', () => {
    localStorage.setItem('apiToken', 's3cret');
    expect(apiHeaders({ 'Content-Type': 'application/json' })).toEqual({
      'Content-Type': 'application/json',
      'X-Api-Token': 's3cret',
    });
  });

  it('works with no extra headers', () => {
    localStorage.setItem('apiToken', 's3cret');
    expect(apiHeaders()).toEqual({ 'X-Api-Token': 's3cret' });
  });
});

describe('assertResponseOk', () => {
  it('allows successful responses', () => {
    expect(() => assertResponseOk({ ok: true, status: 204 }, 'Save')).not.toThrow();
  });

  it('throws a typed error for non-success responses', () => {
    try {
      assertResponseOk({ ok: false, status: 401 }, 'Save weights');
      throw new Error('Expected assertResponseOk to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiRequestError);
      expect(error).toMatchObject({ action: 'Save weights', status: 401 });
      expect((error as Error).message).toBe('Save weights failed: HTTP 401');
    }
  });
});
