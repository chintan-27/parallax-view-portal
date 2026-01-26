"""
Parallax View Portal - Backend API

Handles asset processing jobs for the parallax viewer:
- Image classification (object vs landscape)
- Depth map generation
- Object segmentation
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import assets, jobs
from app.services.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize and cleanup application resources."""
    # Startup
    await init_db()
    yield
    # Shutdown (cleanup if needed)


app = FastAPI(
    title="Parallax View Portal API",
    description="Backend API for processing images into depth-enhanced assets",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
app.include_router(assets.router, prefix="/assets", tags=["assets"])


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "service": "parallax-api", "version": "0.1.0"}


@app.get("/health")
async def health():
    """Detailed health check."""
    return {
        "status": "healthy",
        "database": "connected",
        "processors": {
            "depth": "available",
            "segmentation": "available",
        },
    }
