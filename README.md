# Race Whisperer Predict

Predicts Swedish trotting race outcomes (V75/V85/V86/GS75) from ATG racing data. A
weighted km-time normalization model ranks every horse in a race; weights are tuned
against historical results with an honest train/holdout calibration pipeline.

Two parts:

- **Frontend** — React 18 + TypeScript + Vite (shadcn-ui, Tailwind). Race analysis UI,
  results with actual-vs-predicted comparison, calibration panel, weight editor.
- **Backend** — FastAPI + Postgres (asyncpg). Caches analyses, raw km-times, and MAE
  results; stores model weights/curves; proxies the ATG API.

## Local development

Prerequisites: Node 20+, and for the backend Python 3.12 + Postgres.

```sh
npm ci
npm run dev            # frontend on http://localhost:8080
```

The dev server proxies `/api/atg/*` straight to ATG's public API, so the app runs
without the backend. Persistence endpoints (`/api/analysis`, `/api/rawtimes`,
`/api/weights`, `/api/mae`) need the backend on port 8000:

```sh
cd backend
pip install -r requirements.txt
uvicorn main:app --reload   # uses DATABASE_URL, see .env.example
```

## Tests and checks

```sh
npm run test:run                       # vitest (frontend + model unit tests)
npx tsc -p tsconfig.app.json --noEmit  # type check
npm run lint                           # eslint (no-explicit-any is warn-only)
python -m pytest backend -q            # backend tests
```

CI (`.github/workflows/ci.yml`) runs all four on every push.

## Calibration pipeline

Weight tuning happens offline via `tsx` scripts, not in the browser (the in-app
optimizer scores in-sample and overfits):

```sh
npx tsx scripts/collect-dataset.ts     # resumable ATG collector → calibration dataset JSON
npx tsx scripts/kfold-multistart.ts    # honest k-fold + multistart optimization
npx tsx scripts/eval-holdout.ts        # compare weight configs on a chronological holdout
npx tsx scripts/predict.ts             # CLI predictions for a game
```

Superseded one-off experiments live in `scripts/archive/`. `Kmtime/` holds raw
sectional-timing source data that `npm run build` bakes into
`public/kmTimeRecords.json` — keep it, or fresh builds lose sectional times.

## Configuration

See `.env.example`. Notable:

- `DATABASE_URL` — Postgres connection for the backend.
- `API_TOKEN` — optional shared secret. When set, POST/PUT/DELETE under `/api/*`
  require the same value in the `X-Api-Token` header (reads stay open). The frontend
  sends it from `VITE_API_TOKEN` or `localStorage.setItem('apiToken', '...')`.

## Deployment

- **Docker** (full app): multi-stage `Dockerfile` builds the frontend and serves it
  from FastAPI on port 8000 — `docker build -t race-whisperer . && docker run -p 8000:8000 -e DATABASE_URL=... race-whisperer`.
- **Vercel/Netlify** (frontend only): static build with `/api/atg` rewrites; the
  persistence endpoints need a separately hosted backend.
