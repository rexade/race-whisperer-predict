# Race Whisperer Predict — Failure Patterns

## Scheduling
- Claude Code rate limit resets at 10pm Europe/Stockholm — runs 28 (twice) failed this way. Schedule outside this window.

## Testing
- jsdom ESM incompatibility: caused test suite to fail on import. Fixed in Run 3. If tests break on import, check vitest.config.ts jsdom setup before touching source.
- ATG API call in kmTimeProcessor test (Run 4): test was making real network calls. Fixed with mock. Never introduce real API calls in tests — use fixtures or vitest mocks.

## Code patterns
- console.* calls in service files: diagnostic noise that pollutes browser console on every race load. Known locations: raceDataValidator.ts (fixed Run 21), v75DataConsistencyValidator.ts (open — 20 calls remaining). Always use log.debug/log.error from src/lib/logger.ts.
- Dead post-race analysis cluster: 15 files deleted in Run 8. If you see files referencing post-race prediction, check if they're wired into any active flow before touching them.

## Build
- tsc --noEmit errors block deployment — always run type check after changes
