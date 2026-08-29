/**
 * Shared helper for calls to our own backend (/api/*).
 *
 * Mutating requests and protected debug reads require the server's API_TOKEN.
 * A trusted operator can enter it for this browser without embedding it in the
 * public Vite bundle:
 *
 *   localStorage.setItem('apiToken', '<token>')
 */
export function apiHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('apiToken') : null;
  return token ? { ...extra, 'X-Api-Token': token } : { ...extra };
}

/** Whether this build has a same-origin backend for optional persistence. */
export function isPersistenceApiEnabled(): boolean {
  const configured = import.meta.env.VITE_PERSISTENCE_API_ENABLED;
  if (configured !== undefined) return configured === 'true';
  return import.meta.env.DEV;
}

export class ApiRequestError extends Error {
  constructor(
    public readonly action: string,
    public readonly status: number,
  ) {
    super(`${action} failed: HTTP ${status}`);
    this.name = 'ApiRequestError';
  }
}

export function assertResponseOk(
  response: Pick<Response, 'ok' | 'status'>,
  action: string,
): void {
  if (!response.ok) {
    throw new ApiRequestError(action, response.status);
  }
}

/**
 * Plain-language cause for a failed call to our own backend.
 *
 * The raw response body is useless here and sometimes actively misleading: a
 * frontend-only deploy answers /api with its host's 404 page, so the user sees
 * "NOT_FOUND" and has no way to know that means "no backend is routed", not
 * "your data is wrong".
 */
export function describeApiFailure(status: number): string {
  switch (status) {
    case 404:
      return 'No backend is configured for this deployment, so /api is not routed anywhere. Changes apply in this browser only.';
    case 401:
      return "The API token is missing or wrong. Set localStorage.apiToken to the value of the server's API_TOKEN.";
    case 503:
      return 'The backend is running without API_TOKEN set and refuses writes until it is configured.';
    case 422:
      return 'The backend rejected these values as invalid.';
    default:
      return `The backend returned HTTP ${status}.`;
  }
}
