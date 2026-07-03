import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Bookmark, 
  Globe, 
  Database,
  Radio
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import Watchlist from './components/Watchlist';

const BACKEND_URL = "https://git-trends-backend.onrender.com";

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [watchlist, setWatchlist] = useState([]);
  const [serverOnline, setServerOnline] = useState(false);

  // Check server status
  const checkServerStatus = async () => {
    try {
      const res = await fetch(BACKEND_URL);
      if (res.ok) {
        setServerOnline(true);
      } else {
        setServerOnline(false);
      }
    } catch {
      setServerOnline(false);
    }
  };

  // Fetch current watchlist
  const fetchWatchlist = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/watchlist`);
      if (response.ok) {
        const data = await response.json();
        setWatchlist(data);
      }
    } catch (err) {
      console.error("Failed to load watchlist from API:", err);
    }
  };

  useEffect(() => {
    checkServerStatus();
    fetchWatchlist();
    // Poll server status every 15s
    const statusInterval = setInterval(checkServerStatus, 15000);
    return () => clearInterval(statusInterval);
  }, []);

  // Add repo to watchlist
  const handleAddWatchlist = async (owner, repoName) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/watchlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo_name: repoName })
      });
      if (response.ok) {
        await fetchWatchlist();
        return true;
      }
      return false;
    } catch (err) {
      console.error("Error adding to watchlist:", err);
      return false;
    }
  };

  // Remove repo from watchlist
  const handleRemoveWatchlist = async (owner, repoName) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/watchlist/${owner}/${repoName}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        await fetchWatchlist();
        return true;
      }
      return false;
    } catch (err) {
      console.error("Error removing from watchlist:", err);
      return false;
    }
  };

  // Toggle watchlist (Add if missing, remove if present)
  const handleToggleWatchlist = async (repo) => {
    const exists = watchlist.some(
      item => item.full_name.toLowerCase() === repo.full_name.toLowerCase()
    );
    
    if (exists) {
      await handleRemoveWatchlist(repo.owner, repo.repo_name);
    } else {
      await handleAddWatchlist(repo.owner, repo.repo_name);
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col md:flex-row text-dark-200">
      
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-dark-900 bg-dark-950/80 p-6 flex flex-col justify-between flex-shrink-0">
        <div className="space-y-8">
          
          {/* Logo Area */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-accent-600 rounded-xl shadow-lg shadow-accent-600/30 flex items-center justify-center text-white">
              <Globe className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h1 className="text-base font-bold text-dark-50 font-sans tracking-wide leading-none">GitTrends</h1>
              <span className="text-[10px] text-accent-400 font-semibold tracking-wider uppercase">Tracker Engine</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm rounded-xl transition-all ${
                activeTab === 'dashboard'
                  ? 'active-nav-item'
                  : 'inactive-nav-item'
              }`}
            >
              <TrendingUp className="h-4 w-4" />
              Trending Dashboard
            </button>

            <button
              onClick={() => setActiveTab('watchlist')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm rounded-xl transition-all ${
                activeTab === 'watchlist'
                  ? 'active-nav-item'
                  : 'inactive-nav-item'
              }`}
            >
              <Bookmark className="h-4 w-4" />
              Watchlist Bookmarks
              {watchlist.length > 0 && (
                <span className="ml-auto bg-accent-600/10 text-accent-400 text-xs px-2 py-0.5 rounded-full font-bold">
                  {watchlist.length}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Sidebar Footer / System status */}
        <div className="mt-8 pt-6 border-t border-dark-900 space-y-4">
          <div className="flex items-center gap-2.5 text-xs">
            <Radio className={`h-4 w-4 ${serverOnline ? 'text-success-500 animate-pulse' : 'text-red-500'}`} />
            <div>
              <p className="font-semibold text-dark-300">API Connection</p>
              <p className="text-[10px] text-dark-500">
                {serverOnline ? 'Connected (Port 8000)' : 'Attempting Connection...'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-[10px] text-dark-500 font-medium">
            <Database className="h-3.5 w-3.5" />
            <span>SQLite Engine Active</span>
          </div>
        </div>
      </aside>

      {/* MAIN VIEW AREA */}
      <main className="flex-grow p-4 sm:p-8 overflow-y-auto max-w-7xl">
        <header className="mb-8 space-y-1.5">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-dark-100 font-sans tracking-tight">
            {activeTab === 'dashboard' ? 'Spot Rising Technologies' : 'Personal Watchlist'}
          </h2>
          <p className="text-sm text-dark-400">
            {activeTab === 'dashboard' 
              ? 'Real-time repository statistics from GitHub compiled and visualized daily.' 
              : 'Detailed chronological chart growth tracking for your hand-picked projects.'}
          </p>
        </header>

        {activeTab === 'dashboard' ? (
          <Dashboard 
            watchlist={watchlist} 
            onToggleWatchlist={handleToggleWatchlist} 
            backendUrl={BACKEND_URL} 
          />
        ) : (
          <Watchlist 
            watchlist={watchlist} 
            onAddWatchlist={handleAddWatchlist} 
            onRemoveWatchlist={handleRemoveWatchlist} 
            backendUrl={BACKEND_URL} 
          />
        )}
      </main>

    </div>
  );
}
