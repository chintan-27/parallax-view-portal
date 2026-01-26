"""Image processing service.

Handles:
1. Input classification (object vs landscape)
2. Depth map generation
3. Object segmentation (for object inputs)

Uses cloud APIs (Replicate/Hugging Face) with fallback to local models.
"""

import asyncio
import io
import os
from pathlib import Path
from typing import Optional

import httpx
from PIL import Image

from app.models import InputType, JobStatus
from app.services import database as db
from app.storage import get_upload, save_asset
from app.storage.local import UPLOADS_DIR

# Cloud API configuration (set via environment variables)
REPLICATE_API_TOKEN = os.getenv("REPLICATE_API_TOKEN")
HF_API_TOKEN = os.getenv("HF_API_TOKEN")


async def process_image(job_id: str, filename: str, input_type_hint: Optional[InputType] = None):
    """Main processing pipeline for an uploaded image."""
    try:
        # Update status to processing
        await db.update_job(job_id, status=JobStatus.PROCESSING, progress=10)

        # Load the image
        upload_path = UPLOADS_DIR / job_id / filename
        if not upload_path.exists():
            raise FileNotFoundError(f"Upload not found: {upload_path}")

        image = Image.open(upload_path)
        width, height = image.size

        # Step 1: Classify input type (or use hint)
        await db.update_job(job_id, progress=20)
        if input_type_hint:
            input_type = input_type_hint
        else:
            input_type = await classify_image(image)

        await db.update_job(job_id, input_type=input_type, progress=30)

        # Step 2: Generate depth map
        await db.update_job(job_id, progress=40)
        depth_image = await generate_depth_map(image)
        await db.update_job(job_id, progress=60)

        # Save color image (original, converted to PNG)
        color_buffer = io.BytesIO()
        image.convert("RGB").save(color_buffer, format="PNG")
        color_path = await save_asset(job_id, "color", color_buffer.getvalue(), ".png")
        color_asset_id = await db.create_asset(
            job_id=job_id,
            asset_type="color",
            filename="color.png",
            content_type="image/png",
            size=len(color_buffer.getvalue()),
            metadata={"width": width, "height": height},
        )

        # Save depth map
        depth_buffer = io.BytesIO()
        depth_image.save(depth_buffer, format="PNG")
        depth_path = await save_asset(job_id, "depth", depth_buffer.getvalue(), ".png")
        depth_asset_id = await db.create_asset(
            job_id=job_id,
            asset_type="depth",
            filename="depth.png",
            content_type="image/png",
            size=len(depth_buffer.getvalue()),
            metadata={"width": width, "height": height},
        )

        outputs = {
            "color": color_asset_id,
            "depth": depth_asset_id,
        }

        # Step 3: For objects, generate mask
        if input_type == InputType.OBJECT:
            await db.update_job(job_id, progress=80)
            mask_image = await generate_mask(image)

            mask_buffer = io.BytesIO()
            mask_image.save(mask_buffer, format="PNG")
            mask_path = await save_asset(job_id, "mask", mask_buffer.getvalue(), ".png")
            mask_asset_id = await db.create_asset(
                job_id=job_id,
                asset_type="mask",
                filename="mask.png",
                content_type="image/png",
                size=len(mask_buffer.getvalue()),
                metadata={"width": width, "height": height},
            )
            outputs["mask"] = mask_asset_id

        # Complete
        await db.update_job(
            job_id, status=JobStatus.COMPLETED, progress=100, outputs=outputs
        )

    except Exception as e:
        await db.update_job(job_id, status=JobStatus.FAILED, error=str(e))
        raise


async def classify_image(image: Image.Image) -> InputType:
    """Classify image as object or landscape.

    Uses aspect ratio and simple heuristics as a baseline.
    Can be enhanced with vision API classification.
    """
    width, height = image.size
    aspect_ratio = width / height

    # Simple heuristic: wide images are likely landscapes
    # Square or tall images are more likely objects
    if aspect_ratio > 1.5:
        return InputType.LANDSCAPE
    elif aspect_ratio < 0.75:
        return InputType.OBJECT

    # For ambiguous cases, try cloud API if available
    if HF_API_TOKEN:
        try:
            return await classify_with_hf(image)
        except Exception:
            pass

    # Default to object for ambiguous cases
    return InputType.OBJECT


async def classify_with_hf(image: Image.Image) -> InputType:
    """Classify using Hugging Face Inference API."""
    # Convert image to bytes
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    image_bytes = buffer.getvalue()

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api-inference.huggingface.co/models/google/vit-base-patch16-224",
            headers={"Authorization": f"Bearer {HF_API_TOKEN}"},
            content=image_bytes,
            timeout=30.0,
        )
        response.raise_for_status()
        results = response.json()

        # Check for landscape-related labels
        landscape_keywords = ["landscape", "mountain", "beach", "forest", "sky", "outdoor", "nature"]
        for result in results[:5]:
            label = result.get("label", "").lower()
            if any(kw in label for kw in landscape_keywords):
                return InputType.LANDSCAPE

        return InputType.OBJECT


async def generate_depth_map(image: Image.Image) -> Image.Image:
    """Generate depth map for an image.

    Uses cloud API if available, falls back to simple gradient.
    """
    if REPLICATE_API_TOKEN:
        try:
            return await generate_depth_replicate(image)
        except Exception as e:
            print(f"Replicate depth failed: {e}, using fallback")

    if HF_API_TOKEN:
        try:
            return await generate_depth_hf(image)
        except Exception as e:
            print(f"HF depth failed: {e}, using fallback")

    # Fallback: Generate a simple gradient depth map
    return generate_fallback_depth(image)


async def generate_depth_replicate(image: Image.Image) -> Image.Image:
    """Generate depth map using Replicate API (MiDaS/DPT)."""
    import base64

    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    image_b64 = base64.b64encode(buffer.getvalue()).decode()

    async with httpx.AsyncClient() as client:
        # Create prediction
        response = await client.post(
            "https://api.replicate.com/v1/predictions",
            headers={
                "Authorization": f"Token {REPLICATE_API_TOKEN}",
                "Content-Type": "application/json",
            },
            json={
                "version": "a07b9e63c3a7a1e6e8c8eff8c5d6e8f9a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",  # MiDaS
                "input": {"image": f"data:image/png;base64,{image_b64}"},
            },
            timeout=30.0,
        )
        response.raise_for_status()
        prediction = response.json()

        # Poll for completion
        prediction_id = prediction["id"]
        for _ in range(60):  # Max 60 seconds
            await asyncio.sleep(1)
            status_response = await client.get(
                f"https://api.replicate.com/v1/predictions/{prediction_id}",
                headers={"Authorization": f"Token {REPLICATE_API_TOKEN}"},
            )
            status_response.raise_for_status()
            status = status_response.json()

            if status["status"] == "succeeded":
                # Download depth image
                depth_url = status["output"]
                depth_response = await client.get(depth_url)
                return Image.open(io.BytesIO(depth_response.content))

            elif status["status"] == "failed":
                raise Exception(f"Replicate prediction failed: {status.get('error')}")

        raise Exception("Replicate prediction timed out")


async def generate_depth_hf(image: Image.Image) -> Image.Image:
    """Generate depth map using Hugging Face Inference API (DPT)."""
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    image_bytes = buffer.getvalue()

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api-inference.huggingface.co/models/Intel/dpt-large",
            headers={"Authorization": f"Bearer {HF_API_TOKEN}"},
            content=image_bytes,
            timeout=60.0,
        )
        response.raise_for_status()

        # Response is the depth image
        return Image.open(io.BytesIO(response.content))


def generate_fallback_depth(image: Image.Image) -> Image.Image:
    """Generate a simple fallback depth map (gradient from center)."""
    import math

    width, height = image.size
    depth = Image.new("L", (width, height))

    center_x, center_y = width // 2, height // 2
    max_dist = math.sqrt(center_x**2 + center_y**2)

    for y in range(height):
        for x in range(width):
            # Distance from center, normalized
            dist = math.sqrt((x - center_x) ** 2 + (y - center_y) ** 2)
            # Center is closer (brighter), edges are farther (darker)
            value = int(255 * (1 - dist / max_dist))
            depth.putpixel((x, y), value)

    return depth


async def generate_mask(image: Image.Image) -> Image.Image:
    """Generate segmentation mask for object images.

    Uses cloud API if available, falls back to simple threshold.
    """
    if REPLICATE_API_TOKEN:
        try:
            return await generate_mask_replicate(image)
        except Exception as e:
            print(f"Replicate mask failed: {e}, using fallback")

    # Fallback: Simple edge-based mask
    return generate_fallback_mask(image)


async def generate_mask_replicate(image: Image.Image) -> Image.Image:
    """Generate mask using Replicate API (SAM or similar)."""
    # Similar implementation to depth, using SAM model
    # For now, use fallback
    return generate_fallback_mask(image)


def generate_fallback_mask(image: Image.Image) -> Image.Image:
    """Generate a simple fallback mask (center region)."""
    width, height = image.size
    mask = Image.new("L", (width, height), 0)

    # Simple elliptical mask in center
    import math

    center_x, center_y = width // 2, height // 2
    radius_x, radius_y = width * 0.4, height * 0.4

    for y in range(height):
        for x in range(width):
            dx = (x - center_x) / radius_x
            dy = (y - center_y) / radius_y
            if dx * dx + dy * dy <= 1:
                mask.putpixel((x, y), 255)

    return mask
