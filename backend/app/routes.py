import os
import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func

from .database import get_db
from .models import RepositorySnapshot, WatchlistItem
from .schemas import (
    RepositorySnapshotResponse, 
    WatchlistItemResponse, 
    WatchlistItemCreate,
    RefreshResponse
)
from .scraper import fetch_single_repo_details
from .scheduler import run_trending_pipeline, save_snapshots_to_db

router = APIRouter(prefix="/api")

# Get github token from env if present
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

@router.get("/trending", response_model=List[RepositorySnapshotResponse])
def get_trending(
    time_range: str = "daily", 
    language: Optional[str] = None, 
    db: Session = Depends(get_db)
):
    """
    Returns the latest batch of trending repositories for the specified time_range,
    optionally filtered by programming language.
    """
    if time_range not in ["daily", "weekly", "monthly"]:
        raise HTTPException(status_code=400, detail="Invalid time_range. Use 'daily', 'weekly', or 'monthly'.")

    # Find the timestamp of the latest capture for this time_range
    latest_snapshot = db.query(RepositorySnapshot).filter(
        RepositorySnapshot.time_range == time_range
    ).order_by(RepositorySnapshot.captured_at.desc()).first()

    if not latest_snapshot:
        return []

    # Get all snapshots captured within 2 hours of the latest snapshot run to form a complete batch
    batch_cutoff = latest_snapshot.captured_at - datetime.timedelta(hours=2)
    
    query = db.query(RepositorySnapshot).filter(
        RepositorySnapshot.time_range == time_range,
        RepositorySnapshot.captured_at >= batch_cutoff
    )

    if language and language.strip() != "" and language.lower() != "all":
        # Case insensitive language match
        query = query.filter(func.lower(RepositorySnapshot.language) == language.lower())

    # Sort descending by stars gained in this period (or total stars if stars_today is 0)
    results = query.order_by(RepositorySnapshot.stars_today.desc(), RepositorySnapshot.stars.desc()).all()
    return results

@router.get("/trending/languages", response_model=List[str])
def get_trending_languages(db: Session = Depends(get_db)):
    """
    Returns a distinct list of programming languages available in the trending database.
    """
    languages = db.query(RepositorySnapshot.language).filter(
        RepositorySnapshot.language.isnot(None),
        RepositorySnapshot.language != ""
    ).distinct().all()
    
    # Flatten the list of tuples
    return sorted([lang[0] for lang in languages])

@router.get("/trending/rising", response_model=List[RepositorySnapshotResponse])
def get_rising_fast(db: Session = Depends(get_db)):
    """
    Returns repositories that have seen the largest star growth over the last 7 days.
    Calculated by comparing the maximum and minimum stars in snapshots over the last 7 days.
    """
    seven_days_ago = datetime.datetime.utcnow() - datetime.timedelta(days=7)
    
    # Subquery to calculate growth (max stars - min stars) per repo in the last 7 days
    # We group by full_name
    stats = db.query(
        RepositorySnapshot.full_name,
        (func.max(RepositorySnapshot.stars) - func.min(RepositorySnapshot.stars)).label("growth")
    ).filter(
        RepositorySnapshot.captured_at >= seven_days_ago
    ).group_by(
        RepositorySnapshot.full_name
    ).subquery()
    
    # Get the latest details for the trending repositories
    # Find latest snapshot for each repository
    latest_sub = db.query(
        RepositorySnapshot.full_name,
        func.max(RepositorySnapshot.captured_at).label("latest_time")
    ).group_by(
        RepositorySnapshot.full_name
    ).subquery()
    
    # Join and select the details of the top rising repos
    rising_repos = db.query(RepositorySnapshot, stats.c.growth)\
        .join(latest_sub, (RepositorySnapshot.full_name == latest_sub.c.full_name) & (RepositorySnapshot.captured_at == latest_sub.c.latest_time))\
        .join(stats, RepositorySnapshot.full_name == stats.c.full_name)\
        .order_by(stats.c.growth.desc())\
        .limit(10)\
        .all()
        
    # Format response: we return the RepositorySnapshot object.
    # To represent the growth over the week, we override 'stars_today' with the 7-day growth value.
    response_list = []
    for repo, growth in rising_repos:
        # If growth is 0 (e.g. only one snapshot exist in the database), 
        # fall back to the recorded stars_today or a minor factor
        display_growth = growth if growth > 0 else repo.stars_today
        repo.stars_today = display_growth
        response_list.append(repo)
        
    return response_list

@router.get("/repos/{owner}/{repo}/history")
def get_repo_history(owner: str, repo: str, db: Session = Depends(get_db)):
    """
    Returns historical star data points for a specific repository to build the growth chart.
    """
    full_name = f"{owner}/{repo}"
    
    # Fetch all snapshots for this repository, ordered by capture date
    snapshots = db.query(RepositorySnapshot).filter(
        RepositorySnapshot.full_name.ilike(full_name)
    ).order_by(RepositorySnapshot.captured_at.asc()).all()
    
    if not snapshots:
        # Check if the repo is in our watchlist, if yes we fetch live details and return a single point
        watchlist_item = db.query(WatchlistItem).filter(
            WatchlistItem.full_name.ilike(full_name)
        ).first()
        
        if watchlist_item:
            return [{
                "date": watchlist_item.added_at.strftime("%Y-%m-%d"),
                "stars": watchlist_item.stars,
                "forks": watchlist_item.forks
            }]
        raise HTTPException(status_code=404, detail="No historical snapshot data found for this repository.")

    # Deduplicate snapshots by date (keep the last snapshot of each calendar day)
    history = {}
    for snap in snapshots:
        date_str = snap.captured_at.strftime("%Y-%m-%d")
        history[date_str] = {
            "date": date_str,
            "stars": snap.stars,
            "forks": snap.forks,
            "stars_today": snap.stars_today
        }
        
    return sorted(list(history.values()), key=lambda x: x["date"])

@router.get("/watchlist", response_model=List[WatchlistItemResponse])
def get_watchlist(db: Session = Depends(get_db)):
    """
    Returns all items in the user's watchlist.
    """
    return db.query(WatchlistItem).order_by(WatchlistItem.added_at.desc()).all()

@router.post("/watchlist", response_model=WatchlistItemResponse)
async def add_to_watchlist(payload: WatchlistItemCreate, db: Session = Depends(get_db)):
    """
    Adds a repository to the watchlist, fetching live details from the GitHub API.
    """
    full_name = f"{payload.owner}/{payload.repo_name}"
    
    # Check if already watchlisted
    existing = db.query(WatchlistItem).filter(
        func.lower(WatchlistItem.full_name) == full_name.lower()
    ).first()
    
    if existing:
        return existing
        
    # Fetch live details from GitHub API to populate profile
    details = await fetch_single_repo_details(payload.owner, payload.repo_name, token=GITHUB_TOKEN)
    if not details:
        raise HTTPException(
            status_code=404, 
            detail=f"Repository '{full_name}' not found on GitHub or API rate limit exceeded."
        )
        
    # Create watchlist entry
    item = WatchlistItem(
        repo_name=details["repo_name"],
        owner=details["owner"],
        full_name=details["full_name"],
        description=details["description"],
        language=details["language"],
        stars=details["stars"],
        forks=details["forks"],
        owner_avatar=details["owner_avatar"]
    )
    
    db.add(item)
    db.commit()
    db.refresh(item)
    
    # Immediately save an initial snapshot of the watchlist item so a history point exists
    initial_snapshot = [{
        "repo_name": item.repo_name,
        "owner": item.owner,
        "full_name": item.full_name,
        "description": item.description,
        "language": item.language,
        "stars": item.stars,
        "stars_today": 0,
        "forks": item.forks,
        "owner_avatar": item.owner_avatar,
        "time_range": "watchlist"
    }]
    save_snapshots_to_db(db, initial_snapshot, "watchlist")
    
    return item

@router.delete("/watchlist/{owner}/{repo}")
def remove_from_watchlist(owner: str, repo: str, db: Session = Depends(get_db)):
    """
    Removes a repository from the watchlist.
    """
    full_name = f"{owner}/{repo}"
    item = db.query(WatchlistItem).filter(
        func.lower(WatchlistItem.full_name) == full_name.lower()
    ).first()
    
    if not item:
        raise HTTPException(status_code=404, detail="Repository not found in watchlist.")
        
    db.delete(item)
    db.commit()
    return {"status": "success", "message": f"Removed {full_name} from watchlist."}

@router.post("/refresh", response_model=RefreshResponse)
async def trigger_refresh(background_tasks: BackgroundTasks):
    """
    Triggers a manual crawl to fetch current trending items and update watchlist statistics.
    Runs asynchronously in the background.
    """
    # Run the scraping pipeline in a background task so it doesn't block the API response
    background_tasks.add_task(run_trending_pipeline, GITHUB_TOKEN)
    return {
        "status": "triggered",
        "message": "GitHub trending data refresh triggered. This runs in the background and may take a moment to complete.",
        "repos_fetched": 0
    }
