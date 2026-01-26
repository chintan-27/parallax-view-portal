"""Database service for job queue management using SQLite."""

from __future__ import annotations

import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

import aiosqlite

from app.models import InputType, JobStatus

# Database path
DB_PATH = Path(__file__).parent.parent.parent / "data" / "jobs.db"


async def init_db():
    """Initialize the database schema."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS jobs (
                id TEXT PRIMARY KEY,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                input_type TEXT,
                progress INTEGER DEFAULT 0,
                error TEXT,
                original_filename TEXT,
                outputs TEXT
            )
        """)

        await db.execute("""
            CREATE TABLE IF NOT EXISTS assets (
                id TEXT PRIMARY KEY,
                job_id TEXT NOT NULL,
                asset_type TEXT NOT NULL,
                filename TEXT NOT NULL,
                content_type TEXT NOT NULL,
                size INTEGER NOT NULL,
                metadata TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (job_id) REFERENCES jobs(id)
            )
        """)

        await db.commit()


async def create_job(filename: str, input_type_hint: Optional[InputType] = None) -> dict:
    """Create a new processing job."""
    job_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            INSERT INTO jobs (id, status, created_at, updated_at, input_type, original_filename)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (job_id, JobStatus.PENDING.value, now, now, input_type_hint, filename),
        )
        await db.commit()

    return {
        "id": job_id,
        "status": JobStatus.PENDING,
        "created_at": now,
        "updated_at": now,
        "input_type": input_type_hint,
        "progress": 0,
        "error": None,
        "outputs": None,
    }


async def get_job(job_id: str) -> Optional[dict]:
    """Get job by ID."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)) as cursor:
            row = await cursor.fetchone()
            if row:
                return {
                    "id": row["id"],
                    "status": JobStatus(row["status"]),
                    "created_at": row["created_at"],
                    "updated_at": row["updated_at"],
                    "input_type": InputType(row["input_type"]) if row["input_type"] else None,
                    "progress": row["progress"],
                    "error": row["error"],
                    "outputs": json.loads(row["outputs"]) if row["outputs"] else None,
                }
    return None


async def update_job(
    job_id: str,
    status: Optional[JobStatus] = None,
    input_type: Optional[InputType] = None,
    progress: Optional[int] = None,
    error: Optional[str] = None,
    outputs: Optional[dict] = None,
) -> bool:
    """Update job status and metadata."""
    updates = []
    params = []

    if status is not None:
        updates.append("status = ?")
        params.append(status.value)
    if input_type is not None:
        updates.append("input_type = ?")
        params.append(input_type.value)
    if progress is not None:
        updates.append("progress = ?")
        params.append(progress)
    if error is not None:
        updates.append("error = ?")
        params.append(error)
    if outputs is not None:
        updates.append("outputs = ?")
        params.append(json.dumps(outputs))

    if not updates:
        return False

    updates.append("updated_at = ?")
    params.append(datetime.utcnow().isoformat())
    params.append(job_id)

    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            f"UPDATE jobs SET {', '.join(updates)} WHERE id = ?",
            params,
        )
        await db.commit()
        return db.total_changes > 0


async def create_asset(
    job_id: str,
    asset_type: str,
    filename: str,
    content_type: str,
    size: int,
    metadata: Optional[dict] = None,
) -> str:
    """Create an asset record."""
    asset_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            INSERT INTO assets (id, job_id, asset_type, filename, content_type, size, metadata, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                asset_id,
                job_id,
                asset_type,
                filename,
                content_type,
                size,
                json.dumps(metadata) if metadata else None,
                now,
            ),
        )
        await db.commit()

    return asset_id


async def get_asset(asset_id: str) -> Optional[dict]:
    """Get asset by ID."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM assets WHERE id = ?", (asset_id,)) as cursor:
            row = await cursor.fetchone()
            if row:
                return {
                    "id": row["id"],
                    "job_id": row["job_id"],
                    "asset_type": row["asset_type"],
                    "filename": row["filename"],
                    "content_type": row["content_type"],
                    "size": row["size"],
                    "metadata": json.loads(row["metadata"]) if row["metadata"] else None,
                }
    return None


async def get_assets_by_job(job_id: str) -> list[dict]:
    """Get all assets for a job."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM assets WHERE job_id = ?", (job_id,)) as cursor:
            rows = await cursor.fetchall()
            return [
                {
                    "id": row["id"],
                    "job_id": row["job_id"],
                    "asset_type": row["asset_type"],
                    "filename": row["filename"],
                    "content_type": row["content_type"],
                    "size": row["size"],
                    "metadata": json.loads(row["metadata"]) if row["metadata"] else None,
                }
                for row in rows
            ]
