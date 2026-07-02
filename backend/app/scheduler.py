import os
import datetime
import logging
from sqlalchemy.orm import Session
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from .database import SessionLocal, engine, Base
from .models import RepositorySnapshot, WatchlistItem
from .scraper import fetch_trending_scraping, fetch_trending_api_fallback, fetch_single_repo_details

logger = logging.getLogger(__name__)

def save_snapshots_to_db(db: Session, repos: list, time_range: str):
    """
    Saves repository snapshots to the database. Deduplicates entries
    so that only one snapshot is stored per repository, per time_range, per day.
    """
    today_start = datetime.datetime.combine(datetime.date.today(), datetime.time.min)
    today_end = datetime.datetime.combine(datetime.date.today(), datetime.time.max)
    
    count_new = 0
    count_updated = 0
    
    for repo_data in repos:
        try:
            # Check if we already have a snapshot for this repo in this time_range today
            existing = db.query(RepositorySnapshot).filter(
                RepositorySnapshot.full_name == repo_data["full_name"],
                RepositorySnapshot.time_range == time_range,
                RepositorySnapshot.captured_at >= today_start,
                RepositorySnapshot.captured_at <= today_end
            ).first()
            
            if existing:
                # Update existing snapshot
                existing.stars = repo_data["stars"]
                existing.stars_today = repo_data.get("stars_today", existing.stars_today)
                existing.forks = repo_data["forks"]
                existing.description = repo_data.get("description", existing.description)
                existing.language = repo_data.get("language", existing.language)
                existing.owner_avatar = repo_data.get("owner_avatar", existing.owner_avatar)
                count_updated += 1
            else:
                # Create a new snapshot
                new_snapshot = RepositorySnapshot(
                    repo_name=repo_data["repo_name"],
                    owner=repo_data["owner"],
                    full_name=repo_data["full_name"],
                    description=repo_data.get("description"),
                    language=repo_data.get("language"),
                    stars=repo_data["stars"],
                    stars_today=repo_data.get("stars_today", 0),
                    forks=repo_data["forks"],
                    owner_avatar=repo_data.get("owner_avatar"),
                    time_range=time_range,
                    captured_at=datetime.datetime.utcnow()
                )
                db.add(new_snapshot)
                count_new += 1
        except Exception as e:
            logger.error(f"Error saving snapshot for {repo_data.get('full_name')}: {e}")
            continue
            
    db.commit()
    logger.info(f"Saved {time_range} snapshots: {count_new} created, {count_updated} updated.")
    return count_new + count_updated

async def run_trending_pipeline(token: str = None) -> int:
    """
    Executes the fetching and saving pipeline for daily, weekly, monthly ranges.
    Also updates live stats and appends history for all watchlist items.
    """
    db = SessionLocal()
    total_fetched = 0
    
    try:
        # 1. Fetch and store trending items
        for range_name in ["daily", "weekly", "monthly"]:
            logger.info(f"Starting pipeline fetch for {range_name}...")
            repos = await fetch_trending_scraping(range_name)
            
            # Fallback if scraping gets blocked or is empty
            if not repos:
                logger.info(f"Scraper returned zero results for {range_name}. Using API fallback.")
                repos = await fetch_trending_api_fallback(range_name, token=token)
                
            if repos:
                fetched = save_snapshots_to_db(db, repos, range_name)
                total_fetched += fetched
            else:
                logger.warning(f"Could not fetch trending repos for range: {range_name}")

        # 2. Refresh Watchlist Items (fetch details from API and save as snapshot)
        watchlist_items = db.query(WatchlistItem).all()
        logger.info(f"Refreshing {len(watchlist_items)} watchlisted items...")
        
        watchlist_snapshots = []
        for item in watchlist_items:
            details = await fetch_single_repo_details(item.owner, item.repo_name, token=token)
            if details:
                # Update general info in the watchlist table itself
                item.stars = details["stars"]
                item.forks = details["forks"]
                item.description = details.get("description", item.description)
                item.language = details.get("language", item.language)
                item.owner_avatar = details.get("owner_avatar", item.owner_avatar)
                
                # Append to snapshots for chart visualization history
                watchlist_snapshots.append({
                    "repo_name": item.repo_name,
                    "owner": item.owner,
                    "full_name": item.full_name,
                    "description": details["description"],
                    "language": details["language"],
                    "stars": details["stars"],
                    # growth is computed by comparing with prior db logs if available
                    "stars_today": 0, 
                    "forks": details["forks"],
                    "owner_avatar": details["owner_avatar"],
                    "time_range": "watchlist"
                })
        
        db.commit() # Save watchlist item general updates
        
        if watchlist_snapshots:
            # Save snapshots for watchlist trend history
            fetched_wl = save_snapshots_to_db(db, watchlist_snapshots, "watchlist")
            total_fetched += fetched_wl

    except Exception as e:
        logger.error(f"Error in running trending pipeline: {e}")
    finally:
        db.close()
        
    return total_fetched

# APScheduler instances
scheduler = BackgroundScheduler()

def start_scheduler(token: str = None):
    """
    Initializes and starts the background worker.
    Runs every 6 hours to fetch fresh updates.
    """
    if not scheduler.running:
        # Import asyncio to run the async pipeline inside synchronous scheduler job
        import asyncio
        
        def scheduled_job():
            logger.info("Executing scheduled background trending data update...")
            asyncio.run(run_trending_pipeline(token))

        # Schedule job to run every 6 hours
        scheduler.add_job(
            scheduled_job,
            trigger=CronTrigger(hour="*/6"),
            id="github_trending_tracker_job",
            replace_existing=True
        )
        scheduler.start()
        logger.info("Background scheduler started successfully (interval: every 6 hours).")
