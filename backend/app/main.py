import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from .database import engine, Base, SessionLocal
from .models import RepositorySnapshot
from .routes import router
from .scheduler import start_scheduler, run_trending_pipeline

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Load environmental configurations
load_dotenv()

# Initialize tables
Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions
    token = os.getenv("GITHUB_TOKEN")
    logger.info("Initializing GitHub Trending Tracker API...")
    
    # Start the periodic background scheduler
    start_scheduler(token)
    
    # Auto-populate data on first start if database is empty
    db = SessionLocal()
    try:
        exists = db.query(RepositorySnapshot).first()
        if not exists:
            logger.info("Database is empty. Populating initial trending data on startup...")
            # Run the pipeline synchronously once at start
            await run_trending_pipeline(token)
        else:
            logger.info("Database already contains snapshots. Skipping initial sync.")
    except Exception as e:
        logger.error(f"Failed during database verification on startup: {e}")
    finally:
        db.close()
        
    yield
    # Shutdown actions
    from .scheduler import scheduler
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Background scheduler shut down.")

app = FastAPI(
    title="GitHub Trending Tracker API",
    description="Backend API for tracking, storing, and visualizing trending GitHub repositories.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration to allow local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For production, restrict to actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(router)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "GitHub Trending Tracker API",
        "docs": "/docs"
    }
