# 🔥 GitTrends — GitHub Trending Tracker

A full-stack capstone project that scrapes, stores, and visualizes trending GitHub repositories in real time. Built with **FastAPI** (Python) on the backend and **React + Vite** on the frontend.

---

## 📸 Overview

GitTrends lets you:

- **Browse trending GitHub repositories** filtered by daily, weekly, or monthly time ranges and programming language
- **Visualize star & fork growth history** with interactive line charts
- **Track your own repositories** by adding them to a personal watchlist
- **Export your watchlist** as a CSV file
- **Auto-sync data** every 6 hours via a background scheduler, or manually trigger a refresh

---

## 🏗️ Architecture

```
capstoneproject/
├── backend/               # Python FastAPI backend
│   ├── app/
│   │   ├── main.py        # Application entry point & lifecycle
│   │   ├── database.py    # SQLAlchemy engine & session config
│   │   ├── models.py      # Database models (RepositorySnapshot, WatchlistItem)
│   │   ├── schemas.py     # Pydantic request/response schemas
│   │   ├── routes.py      # API route handlers
│   │   ├── scraper.py     # GitHub trending HTML scraper + API fallback
│   │   └── scheduler.py   # APScheduler background job (6-hour sync)
│   ├── requirements.txt
│   └── .env               # Environment variables (GITHUB_TOKEN, DATABASE_URL)
│
├── frontend/              # React + Vite frontend
│   ├── src/
│   │   ├── App.jsx        # Root component (layout, routing, watchlist state)
│   │   ├── index.css      # Global design system (TailwindCSS v4 theme)
│   │   └── components/
│   │       ├── Dashboard.jsx   # Trending repos view with filters & search
│   │       ├── Watchlist.jsx   # Personal watchlist management
│   │       └── TrendChart.jsx  # Recharts line chart for growth history
│   ├── package.json
│   └── vite.config.js
│
└── venv/                  # Python virtual environment
```

---

## 🔧 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend API** | FastAPI 0.110+ |
| **Database** | SQLite via SQLAlchemy 2.0 |
| **Validation** | Pydantic v2 |
| **Scraping** | httpx + BeautifulSoup4 |
| **Scheduling** | APScheduler 3.10 |
| **Frontend** | React 19 + Vite 8 |
| **Styling** | TailwindCSS v4 (via @tailwindcss/vite) |
| **Charts** | Recharts 3 |
| **Icons** | Lucide React |

---

## 🚀 Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- Git

---

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd capstoneproject
```

---

### 2. Backend Setup

```bash
# Create and activate virtual environment
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt
```

**Configure environment variables:**

Edit `backend/.env`:
```env
# SQLite database URL (default: local file)
DATABASE_URL=sqlite:///./trending_tracker.db

# Optional: GitHub Personal Access Token to avoid API rate limits
# Get one at: https://github.com/settings/tokens
GITHUB_TOKEN=your_personal_access_token_here
```

**Start the backend server:**

```bash
cd backend
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

The API will be available at `http://127.0.0.1:8000`
Interactive docs: `http://127.0.0.1:8000/docs`

> **Note:** On first startup, the app will automatically scrape GitHub trending data and populate the database. This may take 15-30 seconds.

---

### 3. Frontend Setup

```bash
# Open a new terminal
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:5173`

---

## 📡 API Reference

### Trending Repositories

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/trending` | Get latest trending repos (params: `time_range`, `language`) |
| `GET` | `/api/trending/languages` | Get distinct programming languages in DB |
| `GET` | `/api/trending/rising` | Get repos with highest star growth over 7 days |

**Example:**
```
GET /api/trending?time_range=daily&language=Python
GET /api/trending?time_range=weekly
```

### Repository History

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/repos/{owner}/{repo}/history` | Get historical star/fork snapshots for a repo |

### Watchlist

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/watchlist` | Get all watchlisted repositories |
| `POST` | `/api/watchlist` | Add a repository (`{ "owner": "...", "repo_name": "..." }`) |
| `DELETE` | `/api/watchlist/{owner}/{repo}` | Remove a repository from watchlist |

### Sync

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/refresh` | Manually trigger a background data sync |

---

## 🗄️ Database Schema

### `repository_snapshots`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `repo_name` | VARCHAR | Repository name |
| `owner` | VARCHAR | GitHub username/org |
| `full_name` | VARCHAR | `owner/repo_name` |
| `description` | TEXT | Repository description |
| `language` | VARCHAR | Primary programming language |
| `stars` | INTEGER | Total star count at snapshot time |
| `stars_today` | INTEGER | Stars gained in the tracked period |
| `forks` | INTEGER | Fork count |
| `owner_avatar` | VARCHAR | GitHub avatar URL |
| `time_range` | VARCHAR | `daily`, `weekly`, `monthly`, or `watchlist` |
| `captured_at` | DATETIME | Timestamp of this snapshot |

### `watchlist_items`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `repo_name` | VARCHAR | Repository name |
| `owner` | VARCHAR | GitHub username/org |
| `full_name` | VARCHAR | Unique `owner/repo_name` |
| `description` | TEXT | Repository description |
| `language` | VARCHAR | Primary programming language |
| `stars` | INTEGER | Last known star count |
| `forks` | INTEGER | Last known fork count |
| `owner_avatar` | VARCHAR | GitHub avatar URL |
| `added_at` | DATETIME | When the repo was added to watchlist |

---

## How the Data Pipeline Works

1. **Startup**: On first launch, the backend checks if the database is empty. If so, it immediately runs the trending pipeline.
2. **Scraping**: The scraper fetches `github.com/trending?since=daily/weekly/monthly` and parses the HTML using BeautifulSoup.
3. **API Fallback**: If scraping fails (e.g., GitHub blocks the request), it falls back to the GitHub Search API (`/search/repositories`).
4. **Deduplication**: Snapshots are stored once per repository per time_range per day. Running the pipeline multiple times in one day updates existing records.
5. **Watchlist Refresh**: The pipeline also refreshes live stats for all watchlisted repositories using the GitHub REST API.
6. **Scheduler**: APScheduler runs the pipeline every 6 hours automatically in the background.
7. **Manual Sync**: The frontend's "Sync Trends" button triggers an immediate background refresh via `POST /api/refresh`.

---

## Frontend Features

### Dashboard Tab
- **Search bar**: Filter repos by name, owner, description, or language
- **Time range tabs**: Toggle between Daily / Weekly / Monthly views
- **Language filter**: Horizontal scrollable language filter chips
- **Sync button**: Manually trigger a backend data refresh
- **Rising Fast panel**: Sidebar showing repos with the highest 7-day star growth
- **Expandable cards**: Click the chart icon on any repo to view its growth trend chart

### Watchlist Tab
- **Add custom repos**: Track any GitHub repository by entering `owner/repo`
- **Search and filter**: Filter your watchlist by any field
- **Growth chart**: Expand any watchlisted repo to see its historical star/fork chart
- **CSV Export**: Download your full watchlist as a CSV file
- **Remove repos**: Delete individual repos from your watchlist

---

## GitHub Token (Optional but Recommended)

Without a token, the GitHub API allows ~60 requests/hour. With a token, this increases to 5,000 requests/hour.

1. Go to https://github.com/settings/tokens
2. Generate a **Classic** token with `public_repo` scope
3. Add it to `backend/.env`:
   ```
   GITHUB_TOKEN=ghp_your_token_here
   ```
4. Restart the backend server

---

## License

This project was built as a capstone project for educational purposes.

---

## Acknowledgements

- GitHub Trending — data source
- FastAPI — backend framework
- Recharts — charting library
- Lucide React — icon library
- TailwindCSS v4 — styling
