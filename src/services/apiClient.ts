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
