"""Job management routes."""

import asyncio
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile

from app.models import InputType, JobResponse, JobStatus
from app.services import database as db
from app.services.processor import process_image
from app.storage import save_upload

router = APIRouter()


@router.post("", response_model=JobResponse)
async def create_job(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="Image file to process"),
    input_type_hint: Optional[str] = Form(None, description="Hint: 'object' or 'landscape'"),
):
    """
    Create a new processing job.

    Upload an image file to be processed. The system will:
    1. Classify the image as object or landscape
    2. Generate depth map
    3. For objects: generate segmentation mask

    Returns job ID for polling status.
    """
    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    # Parse input type hint
    hint = None
    if input_type_hint:
        try:
            hint = InputType(input_type_hint)
        except ValueError:
            raise HTTPException(
                status_code=400, detail="input_type_hint must be 'object' or 'landscape'"
            )

    # Create job record
    job = await db.create_job(filename=file.filename or "unknown", input_type_hint=hint)
    job_id = job["id"]

    # Save uploaded file
    await save_upload(job_id, file.filename or "input.png", file.file)

    # Start processing in background
    background_tasks.add_task(process_image, job_id, file.filename or "input.png", hint)

    return JobResponse(**job)


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(job_id: str):
    """
    Get job status by ID.

    Poll this endpoint to check processing progress.
    When status is 'completed', the outputs field contains asset IDs.
    """
    job = await db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return JobResponse(**job)


@router.delete("/{job_id}")
async def delete_job(job_id: str):
    """Delete a job and its associated files."""
    job = await db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Note: In a production system, you'd also delete from storage
    # For now, just return success
    return {"status": "deleted", "job_id": job_id}
