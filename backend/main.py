import json
import os
from contextlib import asynccontextmanager
from datetime import date
from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI, Query, Request, Response
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from database import close_pool, get_pool, init_tables

DIST_DIR = Path(__file__).resolve().parent / "dist"
ATG_BASE = "https://www.atg.se/services/racinginfo/v1/api"

# Optional shared secret. When set, every non-read request under /api/
# must carry it in the X-Api-Token header. Reads stay open.
API_TOKEN = os.environ.get("API_TOKEN")

_OPEN_METHODS = {"GET", "HEAD", "OPTIONS"}


def _requires_token(method: str, path: str, configured_token: str | None) -> bool:
    if not configured_token:
        return False
    if method.upper() in _OPEN_METHODS:
        return False
    return path.startswith("/api/")


# ---------------------------------------------------------------------------
# Request body models
# ---------------------------------------------------------------------------

class AnalysisIn(BaseModel):
    raceId: str
    raceNumber: int
    analysisDate: str
    horses: list[Any]


class RawTimesIn(BaseModel):
    raceId: str
    raceNumber: int
    gameId: str
    date: str
    rawTimes: list[Any]
    schemaVersion: int = 6


class RawTimeCandidatesIn(BaseModel):
    raceId: str
    raceNumber: int
    gameId: str
    date: str
    candidateData: Any
    schemaVersion: int = 1


class MaeIn(BaseModel):
    raceId: str
    raceNumber: int
    analysisDate: str
    meanRankError: float
    horseCount: int
    horses: list[Any]


class WeightsIn(BaseModel):
    weights: dict[str, Any]
    postPositionCurves: dict[str, Any] | None = None
    label: str | None = None


def _numeric_time(km_time):
    if not isinstance(km_time, dict):
        return None
    if not all(isinstance(km_time.get(k), (int, float)) for k in ("minutes", "seconds")):
        return None
    return {
        "minutes": km_time.get("minutes"),
        "seconds": km_time.get("seconds"),
        "tenths": km_time.get("tenths", 0),
    }


def _compact_record(record, include_raw: bool = False):
    race = record.get("race") or {}
    start = record.get("start") or {}
    track = record.get("track") or {}
    km_time = record.get("kmTime")

    compact = {
        "date": record.get("date"),
        "raceId": race.get("id"),
        "kmTime": km_time,
        "hasNumericKmTime": _numeric_time(km_time) is not None,
        "place": record.get("place"),
        "finishOrder": record.get("finishOrder"),
        "galloped": bool(record.get("galloped")),
        "disqualified": bool(record.get("disqualified")),
        "odds": record.get("odds"),
        "distance": start.get("distance"),
        "postPosition": start.get("postPosition"),
        "startMethod": race.get("startMethod"),
        "track": track.get("name"),
        "meta": record.get("meta") or {},
    }
    if include_raw:
        compact["rawRecord"] = record
    return compact


def _distance_category_to_meters(distance):
    if distance == "short":
        return 1640
    if distance == "medium":
        return 2140
    if distance == "long":
        return 2640
    return None


def _stat_record_to_result_like(record, year=None, source="statistics"):
    time = (record or {}).get("time") or {}
    if not isinstance(time.get("minutes"), (int, float)) or not isinstance(time.get("seconds"), (int, float)):
        return None

    code = str(record.get("code") or "").lower()
    if code in {"0", "it", "dist", "u", "gdk", "br", "p", "dq"}:
        return None

    is_auto = code.startswith("a")
    letter = code[1:].upper() if is_auto else code.upper()
    distance = record.get("distance") or (
        "short" if letter == "K" else "medium" if letter == "M" else "long" if letter == "L" else None
    )
    start_method = record.get("startMethod") or ("auto" if is_auto else "volte" if letter else None)
    record_date = None
    if year and year != "life":
        current_year = str(date.today().year)
        record_date = f"{year}-12-31" if str(year) == current_year else f"{year}-06-30"

    return {
        "date": record_date,
        "kmTime": {
            "minutes": time.get("minutes"),
            "seconds": time.get("seconds"),
            "tenths": time.get("tenths", 0),
            "code": code,
        },
        "place": str(record.get("place") if record.get("place") is not None else "0"),
        "race": {"id": f"stat_{code}_{year or 'life'}", "startMethod": start_method},
        "track": {"name": "Unknown"},
        "start": {"distance": _distance_category_to_meters(distance), "postPosition": 1},
        "galloped": False,
        "disqualified": False,
        "meta": {
            "code": code,
            "distance": distance,
            "startMethod": start_method,
            "year": year or "life",
            "source": source,
        },
    }


def _statistics_records(horse):
    out = []
    statistics = (horse or {}).get("statistics") or {}
    years = statistics.get("years") or {}
    for year, value in years.items():
        for record in (value or {}).get("records") or []:
            converted = _stat_record_to_result_like(record, year=year)
            if converted:
                out.append(converted)
    for record in ((statistics.get("life") or {}).get("records") or []):
        converted = _stat_record_to_result_like(record, year="life")
        if converted:
            out.append(converted)
    return out


def _best_record_candidate(horse):
    record = (horse or {}).get("record") or {}
    converted = _stat_record_to_result_like(record, year="best", source="record-best")
    if not converted:
        return []
    code = converted["meta"].get("code") or "unknown"
    converted["race"]["id"] = f"record_best_{code}"
    converted["meta"]["isLastResort"] = True
    return [converted]


def _start_number(start):
    # Use `is None` rather than `or` so a legitimate 0 (number or post position) is kept.
    number = start.get("number")
    if number is None:
        number = start.get("postPosition")
    return number


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_tables()
    yield
    await close_pool()


app = FastAPI(lifespan=lifespan)


@app.middleware("http")
async def require_api_token(request: Request, call_next):
    if _requires_token(request.method, request.url.path, API_TOKEN):
        if request.headers.get("x-api-token") != API_TOKEN:
            return JSONResponse({"detail": "invalid or missing API token"}, status_code=401)
    return await call_next(request)

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
async def store_analysis(body: AnalysisIn):
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
        body.raceId,
        body.raceNumber,
        body.analysisDate,
        json.dumps(body.horses),
    )
    return JSONResponse({"ok": True})


@app.delete("/api/analysis/{race_id:path}")
async def delete_analysis(race_id: str):
    pool = await get_pool()
    await pool.execute("DELETE FROM race_analysis WHERE race_id = $1", race_id)
    return JSONResponse({"ok": True})


# ---------------------------------------------------------------------------
# Raw Times CRUD
# ---------------------------------------------------------------------------

@app.get("/api/rawtimes")
async def list_raw_times():
    pool = await get_pool()
    rows = await pool.fetch(
        """SELECT race_id, race_number, game_id, race_date,
                  jsonb_array_length(raw_times) AS horse_count
           FROM raw_times ORDER BY race_date DESC, race_number"""
    )
    return JSONResponse([{
        "raceId": r["race_id"],
        "raceNumber": r["race_number"],
        "gameId": r["game_id"],
        "date": r["race_date"],
        "horseCount": r["horse_count"],
    } for r in rows])


@app.get("/api/rawtimes/{race_id:path}")
async def get_raw_times(race_id: str):
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT * FROM raw_times WHERE race_id = $1", race_id
    )
    if not row:
        return JSONResponse(None)
    d = dict(row)
    rt = json.loads(d["raw_times"]) if isinstance(d["raw_times"], str) else d["raw_times"]
    return JSONResponse({
        "date": d["race_date"],
        "gameId": d["game_id"],
        "raceId": d["race_id"],
        "raceNumber": d["race_number"],
        "rawTimes": rt,
        "cachedAt": str(d["cached_at"]),
        "schemaVersion": d["schema_version"],
    })


@app.post("/api/rawtimes")
async def store_raw_times(body: RawTimesIn):
    pool = await get_pool()
    await pool.execute(
        """INSERT INTO raw_times (race_id, race_number, game_id, race_date, raw_times, schema_version)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6)
           ON CONFLICT (race_id) DO UPDATE SET
               race_number = EXCLUDED.race_number,
               game_id = EXCLUDED.game_id,
               race_date = EXCLUDED.race_date,
               raw_times = EXCLUDED.raw_times,
               schema_version = EXCLUDED.schema_version,
               cached_at = NOW()
        """,
        body.raceId,
        body.raceNumber,
        body.gameId,
        body.date,
        json.dumps(body.rawTimes),
        body.schemaVersion,
    )
    return JSONResponse({"ok": True})


@app.delete("/api/rawtimes/{race_id:path}")
async def delete_raw_times(race_id: str):
    pool = await get_pool()
    await pool.execute("DELETE FROM raw_times WHERE race_id = $1", race_id)
    return JSONResponse({"ok": True})


@app.delete("/api/rawtimes")
async def delete_all_raw_times():
    pool = await get_pool()
    await pool.execute("DELETE FROM raw_times")
    return JSONResponse({"ok": True})


# ---------------------------------------------------------------------------
# Raw Time Candidate CRUD
# ---------------------------------------------------------------------------

@app.get("/api/rawtime-candidates")
async def list_raw_time_candidates():
    pool = await get_pool()
    rows = await pool.fetch(
        """SELECT race_id, race_number, game_id, race_date,
                  jsonb_array_length(candidate_data->'horses') AS horse_count
           FROM raw_time_candidates ORDER BY race_date DESC, race_number"""
    )
    return JSONResponse([{
        "raceId": r["race_id"],
        "raceNumber": r["race_number"],
        "gameId": r["game_id"],
        "date": r["race_date"],
        "horseCount": r["horse_count"],
    } for r in rows])


@app.get("/api/rawtime-candidates/{race_id:path}")
async def get_raw_time_candidates(race_id: str):
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT * FROM raw_time_candidates WHERE race_id = $1", race_id
    )
    if not row:
        return JSONResponse(None)
    d = dict(row)
    candidate_data = (
        json.loads(d["candidate_data"])
        if isinstance(d["candidate_data"], str)
        else d["candidate_data"]
    )
    return JSONResponse({
        "date": d["race_date"],
        "gameId": d["game_id"],
        "raceId": d["race_id"],
        "raceNumber": d["race_number"],
        "candidateData": candidate_data,
        "cachedAt": str(d["cached_at"]),
        "schemaVersion": d["schema_version"],
    })


@app.post("/api/rawtime-candidates")
async def store_raw_time_candidates(body: RawTimeCandidatesIn):
    pool = await get_pool()
    await pool.execute(
        """INSERT INTO raw_time_candidates
           (race_id, race_number, game_id, race_date, candidate_data, schema_version)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6)
           ON CONFLICT (race_id) DO UPDATE SET
               race_number = EXCLUDED.race_number,
               game_id = EXCLUDED.game_id,
               race_date = EXCLUDED.race_date,
               candidate_data = EXCLUDED.candidate_data,
               schema_version = EXCLUDED.schema_version,
               cached_at = NOW()
        """,
        body.raceId,
        body.raceNumber,
        body.gameId,
        body.date,
        json.dumps(body.candidateData),
        body.schemaVersion,
    )
    return JSONResponse({"ok": True})


@app.delete("/api/rawtime-candidates/{race_id:path}")
async def delete_raw_time_candidates(race_id: str):
    pool = await get_pool()
    await pool.execute("DELETE FROM raw_time_candidates WHERE race_id = $1", race_id)
    return JSONResponse({"ok": True})


@app.delete("/api/rawtime-candidates")
async def delete_all_raw_time_candidates():
    pool = await get_pool()
    await pool.execute("DELETE FROM raw_time_candidates")
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
async def store_mae(body: MaeIn):
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
        body.raceId,
        body.raceNumber,
        body.analysisDate,
        body.meanRankError,
        body.horseCount,
        json.dumps(body.horses),
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
async def save_weights(body: WeightsIn):
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute("UPDATE custom_weights SET is_active = FALSE WHERE is_active = TRUE")
            await conn.execute(
                """INSERT INTO custom_weights (weights, post_position_curves, label, is_active)
                   VALUES ($1::jsonb, $2::jsonb, $3, TRUE)""",
                json.dumps(body.weights),
                json.dumps(body.postPositionCurves) if body.postPositionCurves else None,
                body.label,
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
# Debug raw-time inspection
# ---------------------------------------------------------------------------

@app.get("/api/debug/races/{race_id:path}/rawtimes-unfiltered")
async def get_unfiltered_raw_times(
    race_id: str,
    include_raw: bool = Query(False, alias="includeRaw"),
):
    """Return every ATG start-history record before prediction filtering.

    This intentionally does not apply the app's 5-month window, race-date upper
    cutoff, gallop/DQ exclusion, or top-N averaging. It is for inspecting the
    raw input set used by the frontend/services.
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        race_resp = await client.get(
            f"{ATG_BASE}/races/{race_id}",
            headers={"Accept": "application/json"},
        )
        if race_resp.status_code >= 400:
            return Response(
                content=race_resp.content,
                status_code=race_resp.status_code,
                media_type=race_resp.headers.get("content-type", "application/json"),
            )

        race = race_resp.json()
        starts = race.get("starts") or []
        horses = []

        for start in starts:
            number = _start_number(start)
            horse = start.get("horse") or {}
            if number is None:
                horses.append({
                    "startNumber": None,
                    "postPosition": start.get("postPosition"),
                    "horseId": horse.get("id"),
                    "horseName": horse.get("name"),
                    "error": "missing start number/post position",
                    "records": [],
                })
                continue

            detail_resp = await client.get(
                f"{ATG_BASE}/races/{race_id}/start/{number}",
                headers={"Accept": "application/json"},
            )
            if detail_resp.status_code >= 400:
                horses.append({
                    "startNumber": number,
                    "postPosition": start.get("postPosition"),
                    "horseId": horse.get("id"),
                    "horseName": horse.get("name"),
                    "error": f"ATG start fetch failed: {detail_resp.status_code}",
                    "records": [],
                })
                continue

            detail = detail_resp.json()
            detail_horse = detail.get("horse") or {}
            result_records = [
                {**r, "meta": {**(r.get("meta") or {}), "source": "results"}}
                for r in ((detail_horse.get("results") or {}).get("records") or [])
            ]
            statistics_records = _statistics_records(detail_horse)
            best_record = [] if result_records or statistics_records else _best_record_candidate(detail_horse)
            records = result_records + statistics_records + best_record
            compact_records = [_compact_record(r, include_raw=include_raw) for r in records]
            numeric_records = [r for r in compact_records if r["hasNumericKmTime"]]

            horses.append({
                "startNumber": number,
                "postPosition": start.get("postPosition"),
                "horseId": detail_horse.get("id") or horse.get("id"),
                "horseName": detail_horse.get("name") or horse.get("name"),
                "recordCount": len(compact_records),
                "resultRecordCount": len(result_records),
                "statisticsRecordCount": len(statistics_records),
                "bestRecordCount": len(best_record),
                "numericKmTimeCount": len(numeric_records),
                "gallopCount": sum(1 for r in compact_records if r["galloped"]),
                "disqualifiedCount": sum(1 for r in compact_records if r["disqualified"]),
                "records": compact_records,
            })

        return JSONResponse({
            "raceId": race.get("id") or race_id,
            "raceNumber": race.get("number"),
            "date": race.get("date"),
            "track": (race.get("track") or {}).get("name"),
            "startCount": len(starts),
            "unfiltered": True,
            "filtersApplied": [],
            "notes": [
                "No 5-month lower cutoff applied.",
                "No race-date upper cutoff applied.",
                "Galloped and disqualified records are included.",
                "No top-2/top-3 averaging applied.",
            ],
            "horses": horses,
        })


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

def _resolve_within(base: Path, request_path: str):
    """Resolve request_path against base; None unless it lands on a file inside base."""
    try:
        candidate = (base / request_path).resolve()
    except (OSError, ValueError):
        return None
    if not candidate.is_relative_to(base.resolve()):
        return None
    return candidate if candidate.is_file() else None


if DIST_DIR.is_dir():
    # Serve static assets (js, css, images, etc.)
    app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")

    @app.get("/{path:path}")
    async def spa_fallback(path: str):
        # Try exact file first
        file_path = _resolve_within(DIST_DIR, path) if path else None
        if file_path:
            return FileResponse(file_path)
        # Otherwise serve index.html (SPA routing)
        return FileResponse(DIST_DIR / "index.html")
