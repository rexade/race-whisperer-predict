# kmtid.atgx.se Investigation

## Purpose

Document where the post-race analytics shown on kmtid.atgx.se (e.g. FÖRSTA 200 M, SISTA 200 M, SPRUNGNA METER, OMRÄKNAD KM-TID, SLIPSTREAM, performance graph) live so we can extract and use them in the app.

## Investigation steps (run in browser)

1. **Inspect page and network**
   - Open `https://kmtid.atgx.se/260103/` (or the exact URL that shows the participant card).
   - DevTools → Network: filter by XHR/fetch or JS. See which request loads the participant card data (script vs API).
   - Note: data may come from a static JS file (e.g. `races.js`) or from an API on kmtid.atgx.se or another host.

2. **Inspect races.js**
   - Open `https://kmtid.atgx.se/260103/js/races.js` (or the path shown in Network).
   - Check format: global variable (e.g. `window.__RACES__ = {...}`), JSON in a string, or AMD/ES module.
   - Search for: `slipstream`, `FÖRSTA`, `SISTA`, `SPRUNGNA`, `OMRÄKNAD`, `200`, `min/km` to find the screenshot metrics and graph data.

3. **Map to app**
   - Identify structure: e.g. race → starts → per-start fields: first200mPace, last200mPace, metersRun, calculatedKmTime, slipstreamMeters, and the array/object used for the performance graph.
   - Document exact paths and units (pace in min/km, slipstream in meters, graph as time/distance vs value).
   - Update `src/services/kmtid/parseKmtidPayload.ts` (or equivalent) to match the real paths once known.

## Suggested data shape (until real structure is confirmed)

Per-start analytics (match the screenshot):

| Field | Swedish label | Example | Unit / format |
|-------|----------------|---------|----------------|
| first200mPace | FÖRSTA 200 M | 1.28,1 | min/km (e.g. "1.28,1" or seconds) |
| last200mPace | SISTA 200 M | 1.26,7 | min/km |
| metersRun | SPRUNGNA METER | 2149 | meters (number) |
| calculatedKmTime | OMRÄKNAD KM-TID | 1.26,2 | min/km |
| slipstreamMeters | SLIPSTREAM (M) | 197 | meters (number) |
| performanceGraphData | — | pink line | array of { x, y } or { distance, value } |

Likely nesting: races → [ race ] → starts → [ start ] → { first200mPace, last200mPace, metersRun, calculatedKmTime, slipstreamMeters, performanceGraphData }.

## URL pattern

- Base: `https://kmtid.atgx.se/`
- Example: `260103` may be YYMMDD (26 Jan 03) or a game id.
- Script: `https://kmtid.atgx.se/260103/js/races.js`

## App usage: historical data is ~2 weeks old

kmtid.atgx.se data is **always about 2 weeks old**. The app uses it as **historical reference** for the **prediction view** (upcoming races):

1. When you analyze a date (e.g. 2026-01-17), we fetch kmtid for **2 weeks earlier** (e.g. 2026-01-03).
2. Matching to horses in the upcoming race is **best-effort**:
   - **First**: by **horseId** when kmtid exposes it (may be missing or unreliable in an n+1-per-race structure).
   - **Fallback**: by **normalized horse name** (trim, lowercase, collapse spaces) so "ÅSRUD JERVEN" and "Åsrud Jerven" match even when kmtid has no proper horse ID.
3. We build two indexes from the payload: `byHorseId` and `byHorseName`; the UI resolves per horse as `byHorseId.get(horseId) ?? byHorseName.get(normalizeHorseName(horseName))`.
4. In the prediction table (CompactHorseRow), each horse has a **"2w" (Historical)** column: "—" when no match, or "Show" to expand first/last 200m, meters run, slipstream, and the performance graph.
5. Post-race analysis still merges kmtid by raceId:postPosition when viewing results for that date.

When we have the real structure, update the parser in `src/services/kmtid/` to use the correct paths and units.
