# Parallax View Portal API

Backend API for processing images into depth-enhanced assets for the parallax viewer.

## Setup

### Prerequisites
- Python 3.10+
- pip or uv package manager

### Installation

```bash
cd services/api

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -e .

# Or with uv (faster):
uv pip install -e .
```

### Environment Variables

Create a `.env` file or set these environment variables for cloud API access:

```bash
# Optional: Replicate API for high-quality depth maps
REPLICATE_API_TOKEN=your_token_here

# Optional: Hugging Face API for classification and depth
HF_API_TOKEN=your_token_here
```

Without API tokens, the system uses fallback heuristics (simple gradient depth maps).

## Running

```bash
# Development server with auto-reload
uvicorn app.main:app --reload --port 8000

# Production
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

API will be available at http://localhost:8000

## API Endpoints

### Health Check
- `GET /` - Basic health check
- `GET /health` - Detailed health status

### Jobs
- `POST /jobs` - Create a new processing job (upload image)
- `GET /jobs/{job_id}` - Get job status
- `DELETE /jobs/{job_id}` - Delete a job

### Assets
- `GET /assets/{asset_id}` - Get asset metadata
- `GET /assets/{asset_id}/download` - Download asset file
- `GET /assets/job/{job_id}` - Get all assets for a job

## Processing Pipeline

1. **Upload**: Image is uploaded and a job is created
2. **Classification**: Image is classified as "object" or "landscape"
3. **Depth Generation**: Depth map is generated using cloud API or fallback
4. **Segmentation** (objects only): Mask is generated for object cutout
5. **Output**: Assets are stored and job is marked complete

## API Documentation

Interactive docs available at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
