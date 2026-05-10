import os
import asyncpg

_pool: asyncpg.Pool | None = None

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgres://outline:outline@localhost:5432/racewhisperer",
)


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=5)
    return _pool


async def close_pool():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


async def init_tables():
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS race_analysis (
                id            SERIAL PRIMARY KEY,
                race_id       TEXT NOT NULL UNIQUE,
                race_number   INTEGER NOT NULL,
                analysis_date TEXT NOT NULL,
                timestamp     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                horses        JSONB NOT NULL
            );

            CREATE TABLE IF NOT EXISTS race_mae_result (
                id              SERIAL PRIMARY KEY,
                race_id         TEXT NOT NULL UNIQUE,
                race_number     INTEGER NOT NULL,
                analysis_date   TEXT NOT NULL,
                computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                mean_rank_error REAL NOT NULL,
                horse_count     INTEGER NOT NULL,
                horses          JSONB NOT NULL
            );

            CREATE TABLE IF NOT EXISTS raw_times (
                id              SERIAL PRIMARY KEY,
                race_id         TEXT NOT NULL UNIQUE,
                race_number     INTEGER NOT NULL,
                game_id         TEXT NOT NULL,
                race_date       TEXT NOT NULL,
                cached_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                schema_version  INTEGER NOT NULL DEFAULT 6,
                raw_times       JSONB NOT NULL
            );

            CREATE TABLE IF NOT EXISTS custom_weights (
                id                   SERIAL PRIMARY KEY,
                weights              JSONB NOT NULL,
                post_position_curves JSONB,
                label                TEXT,
                is_active            BOOLEAN NOT NULL DEFAULT FALSE,
                created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        """)
