from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

class RepositorySnapshotBase(BaseModel):
    repo_name: str
    owner: str
    full_name: str
    description: Optional[str] = None
    language: Optional[str] = None
    stars: int
    stars_today: int
    forks: int
    owner_avatar: Optional[str] = None
    time_range: str

class RepositorySnapshotCreate(RepositorySnapshotBase):
    pass

class RepositorySnapshotResponse(RepositorySnapshotBase):
    id: int
    captured_at: datetime

    model_config = ConfigDict(from_attributes=True)

class WatchlistItemBase(BaseModel):
    repo_name: str
    owner: str
    full_name: str
    description: Optional[str] = None
    language: Optional[str] = None
    stars: int
    forks: int
    owner_avatar: Optional[str] = None

class WatchlistItemCreate(BaseModel):
    owner: str
    repo_name: str

class WatchlistItemResponse(WatchlistItemBase):
    id: int
    added_at: datetime

    model_config = ConfigDict(from_attributes=True)

class TrendingResponse(BaseModel):
    count: int
    data: List[RepositorySnapshotResponse]

class RefreshResponse(BaseModel):
    status: str
    message: str
    repos_fetched: int
