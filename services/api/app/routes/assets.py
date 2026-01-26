"""Asset retrieval routes."""

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.models import AssetResponse
from app.services import database as db
from app.storage import get_asset_by_id
from app.storage.local import ASSETS_DIR

router = APIRouter()


@router.get("/{asset_id}")
async def get_asset_info(asset_id: str):
    """Get asset metadata by ID."""
    asset = await db.get_asset(asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    return AssetResponse(**asset)


@router.get("/{asset_id}/download")
async def download_asset(asset_id: str):
    """Download asset file by ID."""
    asset = await db.get_asset(asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    # Find the file
    file_path = get_asset_by_id(asset_id, asset["job_id"], asset["filename"])
    if not file_path:
        raise HTTPException(status_code=404, detail="Asset file not found")

    return FileResponse(
        path=file_path,
        media_type=asset["content_type"],
        filename=asset["filename"],
    )


@router.get("/job/{job_id}")
async def get_job_assets(job_id: str):
    """Get all assets for a job."""
    assets = await db.get_assets_by_job(job_id)
    return {"job_id": job_id, "assets": [AssetResponse(**a) for a in assets]}
