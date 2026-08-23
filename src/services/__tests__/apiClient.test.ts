// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { ApiRequestError, apiHeaders, assertResponseOk, describeApiFailure } from '../apiClient';

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

describe('describeApiFailure', () => {
  it('explains a 404 as an unrouted backend rather than echoing the host 404 page', () => {
    // A frontend-only deploy answers /api with its host's "NOT_FOUND" page, which
    // tells the user nothing about what actually went wrong.
    const message = describeApiFailure(404);
    expect(message).toMatch(/no backend is configured/i);
    expect(message).not.toMatch(/NOT_FOUND/);
  });

  it('distinguishes an unconfigured backend from a rejected token', () => {
    expect(describeApiFailure(503)).toMatch(/without API_TOKEN/i);
    expect(describeApiFailure(401)).toMatch(/token is missing or wrong/i);
    expect(describeApiFailure(503)).not.toEqual(describeApiFailure(401));
  });

  it('falls back to the status code for anything unmapped', () => {
    expect(describeApiFailure(500)).toContain('HTTP 500');
  });
});
