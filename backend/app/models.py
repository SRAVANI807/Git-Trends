from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, UniqueConstraint
from .database import Base

class RepositorySnapshot(Base):
    __tablename__ = "repository_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    repo_name = Column(String(100), nullable=False)
    owner = Column(String(100), nullable=False)
    full_name = Column(String(200), index=True, nullable=False) # owner/repo_name
    description = Column(Text, nullable=True)
    language = Column(String(50), index=True, nullable=True)
    stars = Column(Integer, nullable=False)
    stars_today = Column(Integer, default=0) # Stars gained during the period (daily/weekly/monthly)
    forks = Column(Integer, default=0)
    owner_avatar = Column(String(255), nullable=True)
    time_range = Column(String(20), nullable=False) # "daily", "weekly", "monthly", or "watchlist" (to track custom watchlist updates)
    captured_at = Column(DateTime, default=datetime.utcnow, index=True)

    # We shouldn't store multiple snapshots for the same repository at the exact same captured_at day
    # Let's keep it simple for sorting and analytics

class WatchlistItem(Base):
    __tablename__ = "watchlist_items"

    id = Column(Integer, primary_key=True, index=True)
    repo_name = Column(String(100), nullable=False)
    owner = Column(String(100), nullable=False)
    full_name = Column(String(200), unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    language = Column(String(50), nullable=True)
    stars = Column(Integer, default=0)
    forks = Column(Integer, default=0)
    owner_avatar = Column(String(255), nullable=True)
    added_at = Column(DateTime, default=datetime.utcnow)
