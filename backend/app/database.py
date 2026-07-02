import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Database URL, defaults to local SQLite file
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./trending_tracker.db")

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    # SQLite requires check_same_thread=False for multi-threaded access in FastAPI
    connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Dependency to get db session in route handlers
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
