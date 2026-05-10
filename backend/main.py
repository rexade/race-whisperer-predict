import json
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import FastAPI, Request, Response
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from database import close_pool, get_pool, init_tables

DIST_DIR = Path(__file__).resolve().parent / "dist"
ATG_BASE = "https://www.atg.se/services/racinginfo/v1/api"


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_tables()
    yield
    await close_pool()


app = FastAPI(lifespan=lifespan)

# ---------------------------------------------------------------------------
# Analysis CRUD
# ---------------------------------------------------------------------------

@app.get("/api/analysis/dates")
async def get_analysis_dates():
    pool = await get_pool()
    rows = await pool.fetch(
        "SELECT DISTINCT analysis_date FROM race_analysis ORDER BY analysis_date DESC"
    )
    game_ids = [f"v75-{r['analysis_date']}" for r in rows]
    return JSONResponse(game_ids)


@app.get("/api/analysis/date/{date}")
async def has_predictions_for_date(date: str):
    pool = await get_pool()
    count = await pool.fetchval(
        "SELECT COUNT(*) FROM race_analysis WHERE analysis_date = $1", date
    )
    return JSONResponse({"hasPredictions": count > 0, "count": count})


@app.get("/api/analysis")
async def list_analyses():
    pool = await get_pool()
    rows = await pool.fetch(
        """SELECT race_id, race_number, analysis_date, timestamp
           FROM race_analysis
           ORDER BY analysis_date DESC, race_number"""
    )
    results = [{
        "raceId": r["race_id"],
        "raceNumber": r["race_number"],
        "analysisDate": r["analysis_date"],
        "timestamp": str(r["timestamp"]),
    } for r in rows]
    return JSONResponse(results)


@app.get("/api/analysis/{race_id:path}")
async def get_analysis(race_id: str):
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT * FROM race_analysis WHERE race_id = $1", race_id
    )
    if not row:
        return JSONResponse(None)
    data = dict(row)
    data["horses"] = json.loads(data["horses"]) if isinstance(data["horses"], str) else data["horses"]
    return JSONResponse({
        "raceId": data["race_id"],
        "raceNumber": data["race_number"],
        "analysisDate": data["analysis_date"],
        "timestamp": str(data["timestamp"]),
        "horses": data["horses"],
    })


@app.post("/api/analysis")
async def store_analysis(request: Request):
    body = await request.json()
    pool = await get_pool()
    await pool.execute(
        """INSERT INTO race_analysis (race_id, race_number, analysis_date, timestamp, horses)
           VALUES ($1, $2, $3, NOW(), $4::jsonb)
           ON CONFLICT (race_id) DO UPDATE SET
               race_number = EXCLUDED.race_number,
               analysis_date = EXCLUDED.analysis_date,
               timestamp = NOW(),
               horses = EXCLUDED.horses
        """,
        body["raceId"],
        body["raceNumber"],
        body["analysisDate"],
        json.dumps(body["horses"]),
    )
    return JSONResponse({"ok": True})


@app.delete("/api/analysis/{race_id:path}")
async def delete_analysis(race_id: str):
    pool = await get_pool()
    await pool.execute("DELETE FROM race_analysis WHERE race_id = $1", race_id)
    return JSONResponse({"ok": True})


# ---------------------------------------------------------------------------
# MAE CRUD
# ---------------------------------------------------------------------------

@app.get("/api/mae")
async def list_mae():
    pool = await get_pool()
    rows = await pool.fetch(
        """SELECT race_id, race_number, analysis_date, computed_at,
                  mean_rank_error, horse_count, horses
           FROM race_mae_result
           ORDER BY analysis_date DESC, race_number"""
    )
    results = []
    for r in rows:
        d = dict(r)
        d["horses"] = json.loads(d["horses"]) if isinstance(d["horses"], str) else d["horses"]
        results.append({
            "raceId": d["race_id"],
            "raceNumber": d["race_number"],
            "analysisDate": d["analysis_date"],
            "computedAt": str(d["computed_at"]),
            "meanRankError": d["mean_rank_error"],
            "horseCount": d["horse_count"],
            "horses": d["horses"],
        })
    return JSONResponse(results)


@app.get("/api/mae/{race_id:path}")
async def get_mae(race_id: str):
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT * FROM race_mae_result WHERE race_id = $1", race_id
    )
    if not row:
        return JSONResponse(None)
    d = dict(row)
    d["horses"] = json.loads(d["horses"]) if isinstance(d["horses"], str) else d["horses"]
    return JSONResponse({
        "raceId": d["race_id"],
        "raceNumber": d["race_number"],
        "analysisDate": d["analysis_date"],
        "computedAt": str(d["computed_at"]),
        "meanRankError": d["mean_rank_error"],
        "horseCount": d["horse_count"],
        "horses": d["horses"],
    })


@app.post("/api/mae")
async def store_mae(request: Request):
    body = await request.json()
    pool = await get_pool()
    await pool.execute(
        """INSERT INTO race_mae_result
               (race_id, race_number, analysis_date, computed_at,
                mean_rank_error, horse_count, horses)
           VALUES ($1, $2, $3, NOW(), $4, $5, $6::jsonb)
           ON CONFLICT (race_id) DO UPDATE SET
               race_number = EXCLUDED.race_number,
               analysis_date = EXCLUDED.analysis_date,
               computed_at = NOW(),
               mean_rank_error = EXCLUDED.mean_rank_error,
               horse_count = EXCLUDED.horse_count,
               horses = EXCLUDED.horses
        """,
        body["raceId"],
        body["raceNumber"],
        body["analysisDate"],
        body["meanRankError"],
        body["horseCount"],
        json.dumps(body["horses"]),
    )
    return JSONResponse({"ok": True})


# ---------------------------------------------------------------------------
# Weights CRUD
# ---------------------------------------------------------------------------

@app.get("/api/weights")
async def get_weights():
    pool = await get_pool()
    row = await pool.fetchrow(
        """SELECT id, weights, post_position_curves, label, created_at
           FROM custom_weights WHERE is_active = TRUE
           ORDER BY created_at DESC LIMIT 1"""
    )
    if not row:
        return JSONResponse(None)
    d = dict(row)
    w = json.loads(d["weights"]) if isinstance(d["weights"], str) else d["weights"]
    c = json.loads(d["post_position_curves"]) if isinstance(d["post_position_curves"], str) else d["post_position_curves"]
    return JSONResponse({
        "id": d["id"],
        "weights": w,
        "postPositionCurves": c,
        "label": d["label"],
        "createdAt": str(d["created_at"]),
    })


@app.put("/api/weights")
async def save_weights(request: Request):
    body = await request.json()
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute("UPDATE custom_weights SET is_active = FALSE WHERE is_active = TRUE")
            await conn.execute(
                """INSERT INTO custom_weights (weights, post_position_curves, label, is_active)
                   VALUES ($1::jsonb, $2::jsonb, $3, TRUE)""",
                json.dumps(body["weights"]),
                json.dumps(body.get("postPositionCurves")) if body.get("postPositionCurves") else None,
                body.get("label"),
            )
    return JSONResponse({"ok": True})


@app.get("/api/weights/history")
async def weights_history():
    pool = await get_pool()
    rows = await pool.fetch(
        """SELECT id, label, is_active, created_at
           FROM custom_weights ORDER BY created_at DESC LIMIT 50"""
    )
    return JSONResponse([{
        "id": r["id"],
        "label": r["label"],
        "isActive": r["is_active"],
        "createdAt": str(r["created_at"]),
    } for r in rows])


# ---------------------------------------------------------------------------
# ATG proxy
# ---------------------------------------------------------------------------

@app.api_route("/api/atg/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def atg_proxy(path: str, request: Request):
    url = f"{ATG_BASE}/{path}"
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.request(
            method=request.method,
            url=url,
            headers={"Accept": "application/json"},
            content=await request.body() if request.method != "GET" else None,
        )
    return Response(
        content=resp.content,
        status_code=resp.status_code,
        media_type=resp.headers.get("content-type", "application/json"),
    )


# ---------------------------------------------------------------------------
# SPA fallback — serve dist/
# ---------------------------------------------------------------------------

if DIST_DIR.is_dir():
    # Serve static assets (js, css, images, etc.)
    app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")

    @app.get("/{path:path}")
    async def spa_fallback(path: str):
        # Try exact file first
        file_path = DIST_DIR / path
        if path and file_path.is_file():
            return FileResponse(file_path)
        # Otherwise serve index.html (SPA routing)
        return FileResponse(DIST_DIR / "index.html")
