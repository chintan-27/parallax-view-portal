"""Local file storage for uploads and processed assets."""

from __future__ import annotations

import shutil
from pathlib import Path
from typing import BinaryIO, Optional

# Storage paths
STORAGE_ROOT = Path(__file__).parent.parent.parent / "data" / "storage"
UPLOADS_DIR = STORAGE_ROOT / "uploads"
ASSETS_DIR = STORAGE_ROOT / "assets"


def init_storage():
    """Initialize storage directories."""
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)


def get_upload_path(job_id: str, filename: str) -> Path:
    """Get path for uploaded file."""
    job_dir = UPLOADS_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    return job_dir / filename


def get_asset_path(job_id: str, asset_type: str, extension: str) -> Path:
    """Get path for processed asset."""
    job_dir = ASSETS_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    return job_dir / f"{asset_type}{extension}"


async def save_upload(job_id: str, filename: str, file: BinaryIO) -> Path:
    """Save uploaded file to storage."""
    init_storage()
    path = get_upload_path(job_id, filename)

    with open(path, "wb") as f:
        shutil.copyfileobj(file, f)

    return path


async def save_asset(job_id: str, asset_type: str, data: bytes, extension: str) -> Path:
    """Save processed asset to storage."""
    init_storage()
    path = get_asset_path(job_id, asset_type, extension)

    with open(path, "wb") as f:
        f.write(data)

    return path


def get_upload(job_id: str, filename: str) -> Optional[Path]:
    """Get uploaded file path if exists."""
    path = get_upload_path(job_id, filename)
    return path if path.exists() else None


def get_asset(job_id: str, asset_type: str, extension: str) -> Optional[Path]:
    """Get asset file path if exists."""
    path = get_asset_path(job_id, asset_type, extension)
    return path if path.exists() else None


def get_asset_by_id(asset_id: str, job_id: str, filename: str) -> Optional[Path]:
    """Get asset file by looking up in job directory."""
    job_dir = ASSETS_DIR / job_id
    if not job_dir.exists():
        return None

    # Look for the file
    path = job_dir / filename
    return path if path.exists() else None


def delete_job_files(job_id: str):
    """Delete all files associated with a job."""
    upload_dir = UPLOADS_DIR / job_id
    asset_dir = ASSETS_DIR / job_id

    if upload_dir.exists():
        shutil.rmtree(upload_dir)
    if asset_dir.exists():
        shutil.rmtree(asset_dir)
