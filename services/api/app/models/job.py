"""Job and asset data models."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class JobStatus(str, Enum):
    """Job processing status."""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class InputType(str, Enum):
    """Classified input type."""

    OBJECT = "object"
    LANDSCAPE = "landscape"
    UNKNOWN = "unknown"


class JobCreate(BaseModel):
    """Request model for creating a new job."""

    filename: str = Field(..., description="Original filename")
    input_type_hint: Optional[InputType] = Field(
        None, description="Optional hint for input type (object/landscape)"
    )


class JobResponse(BaseModel):
    """Response model for job status."""

    id: str = Field(..., description="Unique job ID")
    status: JobStatus = Field(..., description="Current job status")
    created_at: datetime = Field(..., description="Job creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    input_type: Optional[InputType] = Field(None, description="Classified input type")
    progress: int = Field(0, ge=0, le=100, description="Processing progress percentage")
    error: Optional[str] = Field(None, description="Error message if failed")
    outputs: Optional[dict] = Field(None, description="Output asset IDs when completed")


class AssetMetadata(BaseModel):
    """Metadata for processed assets."""

    job_id: str
    input_type: InputType
    original_filename: str
    width: int
    height: int
    depth_min: Optional[float] = None
    depth_max: Optional[float] = None
    parallax_strength: Optional[float] = Field(
        None, description="Suggested parallax strength (0-1)"
    )
    has_mask: bool = False
    created_at: datetime


class AssetResponse(BaseModel):
    """Response model for asset info."""

    id: str
    job_id: str
    asset_type: str  # "color", "depth", "mask"
    filename: str
    content_type: str
    size: int
    metadata: Optional[dict] = None
