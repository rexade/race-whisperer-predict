/**
 * Polyfills for running Vite-based project code in Node.js
 * Load via: npx tsx --import ./scripts/node-polyfills.ts <script>
 */

// localStorage / sessionStorage
const storage = new Map<string, string>();
const lsMock = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => storage.set(k, v),
  removeItem: (k: string) => storage.delete(k),
  get length() { return storage.size; },
  clear: () => storage.clear(),
  key: (i: number) => [...storage.keys()][i] ?? null,
};
(globalThis as any).localStorage = lsMock;
(globalThis as any).sessionStorage = lsMock;
(globalThis as any).window = globalThis;
