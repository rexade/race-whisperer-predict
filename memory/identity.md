# Race Whisperer Predict — Stable Identity

**Project:** V75 horse race analysis tool for ATG.se races
**Stack:** React 18 + TypeScript + Vite + Tailwind + shadcn/ui + React Query + Vitest
**Source:** /home/admin/race-whisperer-predict/src/
**Entry:** src/App.tsx → V75Analyzer.tsx (single-page)
**Tests:** 71 tests (Vitest), run with `npx vitest run`
**Build check:** `tsc --noEmit` must pass before any run is marked successful
**Run log:** /home/admin/race-whisperer-predict/reports/RUN_LOG.md
**Reference engine:** /home/admin/v85-briefing-engine/ (Python V85, read for porting ideas only)
**Run loop:** mutate → mutate → research → mutate → repeat
**Current run count:** ~21
