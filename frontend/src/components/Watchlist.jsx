import React, { useState, useEffect } from 'react';
import { 
  Star, 
  GitFork, 
  Trash2, 
  Download, 
  Plus, 
  Search, 
  AlertCircle,
  TrendingUp,
  LineChart as ChartIcon,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import TrendChart from './TrendChart';

export default function Watchlist({ 
  watchlist, 
  onAddWatchlist, 
  onRemoveWatchlist, 
  backendUrl 
}) {
  const [newRepoPath, setNewRepoPath] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [success, setSuccess] = useState('');
  
  const [expandedRepo, setExpandedRepo] = useState(null); // full_name
  const [chartData, setChartData] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);

  // Handle adding a custom repository (format: owner/repo)
  const handleAddRepo = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    const cleanPath = newRepoPath.trim();
    if (!cleanPath) return;

    const parts = cleanPath.split('/');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      setError('Please enter a valid format: "owner/repo" (e.g. tiangolo/fastapi)');
      return;
    }

    const [owner, repoName] = parts;
    setAdding(true);
    
    try {
      const added = await onAddWatchlist(owner, repoName);
      if (added) {
        setSuccess(`Successfully added ${cleanPath} to watchlist!`);
        setNewRepoPath('');
        setTimeout(() => setSuccess(''), 4000);
      } else {
        setError(`Failed to find repository "${cleanPath}" or it is already in your watchlist.`);
      }
    } catch (err) {
      setError('An unexpected error occurred while adding the repository.');
    } finally {
      setAdding(false);
    }
  };

  // Export watchlist database records as CSV
  const handleExportCSV = () => {
    if (watchlist.length === 0) return;
    
    // Header Row
    const headers = ['Repository', 'Owner', 'Language', 'Stars', 'Forks', 'Added At'];
    
    // Rows mapping
    const rows = watchlist.map(item => [
      item.repo_name,
      item.owner,
      item.language || 'Unknown',
      item.stars,
      item.forks,
      new Date(item.added_at).toLocaleString()
    ]);
    
    // Join CSV components
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `github_watchlist_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link); // Required for FF
    
    link.click();
    document.body.removeChild(link);
  };

  // Load history data when repo card is expanded
  const handleExpandRepo = async (fullName) => {
    if (expandedRepo === fullName) {
      setExpandedRepo(null);
      return;
    }
    
    setExpandedRepo(fullName);
    setChartLoading(true);
    setChartData([]);
    
    const [owner, name] = fullName.split('/');
    try {
      const response = await fetch(`${backendUrl}/api/repos/${owner}/${name}/history`);
      if (response.ok) {
        const data = await response.json();
        setChartData(data);
      } else {
        setChartData([]);
      }
    } catch (err) {
      console.error("Error fetching repo history:", err);
      setChartData([]);
    } finally {
      setChartLoading(false);
    }
  };

  // Filter watchlist list by search query
  const filteredWatchlist = watchlist.filter(item => {
    const term = searchQuery.toLowerCase();
    return (
      item.repo_name.toLowerCase().includes(term) ||
      item.owner.toLowerCase().includes(term) ||
      (item.description && item.description.toLowerCase().includes(term)) ||
      (item.language && item.language.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6">
      
      {/* Search and Add Top Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Add custom repo to track */}
        <div className="lg:col-span-1 glass-card p-6 rounded-2xl space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-dark-300 uppercase tracking-wider">Track New Repository</h3>
            <p className="text-xs text-dark-400 mt-0.5">Add custom repositories to your watch list</p>
          </div>

          <form onSubmit={handleAddRepo} className="space-y-3">
            <div>
              <input
                type="text"
                placeholder="owner/repo-name (e.g. vlang/v)"
                value={newRepoPath}
                onChange={(e) => setNewRepoPath(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-dark-900 border border-dark-850 rounded-xl focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500 text-dark-100 placeholder-dark-500 transition-all"
              />
            </div>
            
            <button
              type="submit"
              disabled={adding || !newRepoPath.trim()}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 text-xs font-semibold rounded-xl bg-accent-600 hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-lg shadow-accent-600/20 transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              {adding ? 'Fetching Info...' : 'Add to Watchlist'}
            </button>
          </form>

          {/* Feedback states */}
          {error && (
            <div className="flex gap-2 items-start text-xs text-red-400 bg-red-950/20 border border-red-500/15 p-3 rounded-xl">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex gap-2 items-start text-xs text-success-500 bg-success-600/10 border border-success-600/10 p-3 rounded-xl">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}
        </div>

        {/* Search & Export options */}
        <div className="lg:col-span-2 glass-card p-6 rounded-2xl flex flex-col justify-between gap-4">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-dark-300 uppercase tracking-wider">Watchlist Management</h3>
              <p className="text-xs text-dark-400 mt-0.5">Filter, monitor, and export tracked project details</p>
            </div>
            
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-400" />
              <input
                type="text"
                placeholder="Search watchlist..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm bg-dark-900 border border-dark-850 rounded-xl focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500 text-dark-100 placeholder-dark-500 transition-all"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleExportCSV}
              disabled={watchlist.length === 0}
              className="flex items-center gap-2 py-2 px-4 text-xs font-semibold rounded-xl border border-dark-750 bg-dark-900 text-dark-200 hover:bg-dark-800 disabled:opacity-50 disabled:cursor-not-allowed hover:text-white transition-all"
            >
              <Download className="h-4 w-4" />
              Export watchlist CSV
            </button>
          </div>
        </div>
      </div>

      {/* Watchlist cards */}
      <div className="space-y-4">
        {filteredWatchlist.length === 0 ? (
          <div className="glass-card p-16 rounded-2xl text-center space-y-4">
            <TrendingUp className="h-12 w-12 text-dark-500 mx-auto" />
            <div className="space-y-1">
              <h3 className="text-dark-300 font-semibold">Your watchlist is empty</h3>
              <p className="text-dark-400 text-xs max-w-sm mx-auto">
                {searchQuery 
                  ? 'No watchlisted repositories match your filter query.' 
                  : 'Start tracking repositories to see their growth trends graphed over time.'}
              </p>
            </div>
          </div>
        ) : (
          filteredWatchlist.map((item, idx) => {
            const isExpanded = expandedRepo === item.full_name;
            
            return (
              <div 
                key={item.id || `${item.full_name}-${idx}`} 
                className={`glass-card rounded-2xl overflow-hidden glass-card-hover ${
                  isExpanded ? 'border-accent-500/30' : ''
                }`}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    
                    <div className="flex gap-4 items-start">
                      <img 
                        src={item.owner_avatar} 
                        alt={item.owner} 
                        onError={(e) => {
                          e.target.onerror = null; 
                          e.target.src = `https://github.com/${item.owner}.png`;
                        }}
                        className="w-10 h-10 rounded-xl bg-dark-900 border border-dark-800 object-cover"
                      />
                      
                      <div>
                        <h3 className="text-base font-semibold text-dark-100 flex items-center flex-wrap gap-1">
                          <span className="text-dark-400 font-normal hover:underline cursor-pointer">
                            <a href={`https://github.com/${item.owner}`} target="_blank" rel="noreferrer">
                              {item.owner}
                            </a>
                          </span>
                          <span className="text-dark-500 font-normal">/</span>
                          <span className="hover:underline cursor-pointer text-accent-400">
                            <a href={`https://github.com/${item.owner}/${item.repo_name}`} target="_blank" rel="noreferrer">
                              {item.repo_name}
                            </a>
                          </span>
                        </h3>
                        
                        <div className="flex items-center gap-4 mt-2">
                          {item.language && (
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-accent-500 shadow-sm"></span>
                              <span className="text-xs text-dark-300 font-medium">{item.language}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1 text-xs text-dark-400">
                            <Star className="h-3.5 w-3.5 fill-dark-500 stroke-dark-500" />
                            <span>{item.stars.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-dark-400">
                            <GitFork className="h-3.5 w-3.5 text-dark-500" />
                            <span>{item.forks.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Delete watchlisted */}
                      <button
                        onClick={() => onRemoveWatchlist(item.owner, item.repo_name)}
                        title="Remove from watchlist"
                        className="p-2 rounded-xl border border-dark-800 bg-dark-900 text-dark-400 hover:text-red-400 hover:border-red-950 transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      
                      {/* Open Growth Trend */}
                      <button
                        onClick={() => handleExpandRepo(item.full_name)}
                        title="View trend details"
                        className={`p-2 rounded-xl border transition-all ${
                          isExpanded 
                            ? 'bg-accent-600 text-white border-accent-500' 
                            : 'bg-dark-900 border-dark-800 text-dark-400 hover:text-dark-200 hover:border-dark-700'
                        }`}
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChartIcon className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {item.description && (
                    <p className="mt-3.5 text-sm text-dark-400 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>

                {/* Expanded: Growth Chart */}
                {isExpanded && (
                  <div className="border-t border-dark-850 p-6 bg-dark-950/40">
                    <TrendChart 
                      repoName={item.full_name} 
                      data={chartData} 
                      loading={chartLoading} 
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
