# Race Whisperer Predict

Predicts Swedish trotting race outcomes (V75/V85/V86/V65) from ATG racing data. A
weighted km-time normalization model ranks every horse in a race; weights are tuned
against historical results with an honest train/holdout calibration pipeline.

Two parts:

- **Frontend** — React 18 + TypeScript + Vite (shadcn-ui, Tailwind). Race analysis UI,
  results with actual-vs-predicted comparison, calibration panel, weight editor.
- **Backend** — FastAPI + Postgres (asyncpg). Caches analyses, raw km-times, and MAE
  results; stores model weights/curves; proxies the ATG API.

## Local development

Prerequisites: Node 20.19+ or 22.12+, and for the backend Python 3.12 + Postgres.

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
uvicorn main:app --reload --env-file ../.env
```

Copy `.env.example` to `.env`, set `DATABASE_URL`, and generate a strong
`API_TOKEN` before using persistence. Mutations fail closed with HTTP 503 when
the backend token is empty. On a trusted operator browser, set the same token at
runtime with `localStorage.setItem('apiToken', '...')`. Do not put the token in a
`VITE_*` variable: Vite values are compiled into public JavaScript.

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
- `API_TOKEN` — required for POST/PUT/DELETE under `/api/*` and for the expensive
  `/api/debug/*` inspection routes. Ordinary reads stay open. If the token is absent,
  protected requests fail with HTTP 503 rather than running unauthenticated. A trusted
  operator can provide it through `localStorage.setItem('apiToken', '...')`; it must
  never be configured as a `VITE_*` build variable.

## Deployment

- **Docker** (full app): multi-stage `Dockerfile` builds the frontend and serves it
  from FastAPI on port 8000. Set `DATABASE_URL` and `API_TOKEN` in a local `.env`
  file, then run `docker build -t race-whisperer . && docker run --env-file .env -p 8000:8000 race-whisperer`.
  Environment files are excluded from the Docker build context and are never baked
  into the frontend image.
- **Vercel/Netlify** (frontend only): static build with `/api/atg` rewrites; the
  persistence endpoints need a separately hosted backend.
