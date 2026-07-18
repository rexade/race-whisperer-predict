// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { apiHeaders } from '../apiClient';

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
