/**
 * Shared helper for calls to our own backend (/api/*).
 *
 * When the backend is started with an API_TOKEN env var, every mutating
 * request must carry it in the X-Api-Token header. The token is read from
 * VITE_API_TOKEN at build time, or from localStorage('apiToken') so it can
 * be set once per browser without rebuilding:
 *
 *   localStorage.setItem('apiToken', '<token>')
 */
export function apiHeaders(extra: Record<string, string> = {}): Record<string, string> {
  let token: string | null | undefined = import.meta.env?.VITE_API_TOKEN;
  if (!token && typeof localStorage !== 'undefined') {
    token = localStorage.getItem('apiToken');
  }
  return token ? { ...extra, 'X-Api-Token': token } : { ...extra };
}
