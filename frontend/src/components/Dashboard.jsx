import React, { useState, useEffect } from 'react';
import { 
  Star, 
  GitFork, 
  RefreshCw, 
  Search, 
  Flame, 
  Languages, 
  Clock, 
  Plus, 
  Trash2, 
  LineChart as ChartIcon,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import TrendChart from './TrendChart';

export default function Dashboard({ 
  watchlist, 
  onToggleWatchlist, 
  backendUrl 
}) {
  const [repos, setRepos] = useState([]);
  const [risingRepos, setRisingRepos] = useState([]);
  const [languages, setLanguages] = useState([]);
  
  const [selectedLanguage, setSelectedLanguage] = useState('All');
  const [selectedTimeRange, setSelectedTimeRange] = useState('daily');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [risingLoading, setRisingLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState('');
  
  const [expandedRepo, setExpandedRepo] = useState(null); // full_name
  const [chartData, setChartData] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);

  // Fetch trending repos
  const fetchTrending = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${backendUrl}/api/trending?time_range=${selectedTimeRange}&language=${
          selectedLanguage === 'All' ? '' : selectedLanguage
        }`
      );
      if (response.ok) {
        const data = await response.json();
        setRepos(data);
      }
    } catch (err) {
      console.error("Error fetching trending repositories:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch rising fast repos
  const fetchRising = async () => {
    setRisingLoading(true);
    try {
      const response = await fetch(`${backendUrl}/api/trending/rising`);
      if (response.ok) {
        const data = await response.json();
        setRisingRepos(data);
      }
    } catch (err) {
      console.error("Error fetching rising repositories:", err);
    } finally {
      setRisingLoading(false);
    }
  };

  // Fetch languages
  const fetchLanguages = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/trending/languages`);
      if (response.ok) {
        const data = await response.json();
        setLanguages(['All', ...data]);
      }
    } catch (err) {
      console.error("Error fetching languages:", err);
    }
  };

  useEffect(() => {
    fetchTrending();
  }, [selectedTimeRange, selectedLanguage]);

  useEffect(() => {
    fetchRising();
    fetchLanguages();
  }, []);

  // Handle manual sync refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshMessage('Requesting sync...');
    try {
      const response = await fetch(`${backendUrl}/api/refresh`, { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        setRefreshMessage(data.message);
        // Wait 3 seconds and reload the dashboard lists
        setTimeout(() => {
          fetchTrending();
          fetchRising();
          fetchLanguages();
          setRefreshing(false);
          setRefreshMessage('');
        }, 4000);
      } else {
        setRefreshing(false);
        setRefreshMessage('');
      }
    } catch (err) {
      console.error("Failed to trigger sync refresh:", err);
      setRefreshing(false);
      setRefreshMessage('');
    }
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

  // Check if a repo is bookmarked
  const isBookmarked = (fullName) => {
    return watchlist.some(item => item.full_name.toLowerCase() === fullName.toLowerCase());
  };

  // Filter list by search query
  const filteredRepos = repos.filter(repo => {
    const term = searchQuery.toLowerCase();
    return (
      repo.repo_name.toLowerCase().includes(term) ||
      repo.owner.toLowerCase().includes(term) ||
      (repo.description && repo.description.toLowerCase().includes(term)) ||
      (repo.language && repo.language.toLowerCase().includes(term))
    );
  });

  // Language Dot Color Helper
  const getLanguageColor = (lang) => {
    if (!lang) return 'bg-dark-500';
    const colors = {
      python: 'bg-emerald-500 shadow-emerald-500/40',
      javascript: 'bg-yellow-500 shadow-yellow-500/40',
      typescript: 'bg-blue-500 shadow-blue-500/40',
      rust: 'bg-orange-500 shadow-orange-500/40',
      go: 'bg-cyan-500 shadow-cyan-500/40',
      c: 'bg-gray-500 shadow-gray-500/40',
      'c++': 'bg-pink-500 shadow-pink-500/40',
      java: 'bg-red-500 shadow-red-500/40',
      html: 'bg-orange-600 shadow-orange-600/40',
      ruby: 'bg-red-600 shadow-red-600/40',
    };
    return colors[lang.toLowerCase()] || 'bg-accent-500 shadow-accent-500/40';
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
      
      {/* MAIN CONTENT AREA: Filters + Repo Lists (Span 3 on large screens) */}
      <div className="xl:col-span-3 space-y-6">
        
        {/* Controls Panel */}
        <div className="glass-card p-4 sm:p-6 rounded-2xl space-y-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            
            {/* Search Input */}
            <div className="relative flex-grow max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-400" />
              <input
                type="text"
                placeholder="Search trending repos, owners, descriptions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm bg-dark-900 border border-dark-800 rounded-xl focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500 text-dark-100 placeholder-dark-500 transition-all"
              />
            </div>

            {/* Actions: Refresh and Time range tabs */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Refresh Button */}
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl border border-dark-700 bg-dark-900 text-dark-200 hover:bg-dark-800 transition-all ${
                  refreshing ? 'opacity-65 cursor-not-allowed' : ''
                }`}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Syncing...' : 'Sync Trends'}
              </button>

              {/* Time Range Selector */}
              <div className="flex bg-dark-900 border border-dark-850 rounded-xl p-1">
                {['daily', 'weekly', 'monthly'].map((range) => (
                  <button
                    key={range}
                    onClick={() => setSelectedTimeRange(range)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-all ${
                      selectedTimeRange === range
                        ? 'bg-accent-600 text-white shadow-lg shadow-accent-600/20'
                        : 'text-dark-400 hover:text-dark-200'
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Languages Scroll List */}
          <div className="border-t border-dark-800/60 pt-4">
            <div className="flex items-center gap-2 text-xs text-dark-400 mb-2 font-medium">
              <Languages className="h-3.5 w-3.5 text-accent-500" />
              Filter by Programming Language:
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
              {languages.map((lang) => (
                <button
                  key={lang}
                  onClick={() => setSelectedLanguage(lang)}
                  className={`flex-shrink-0 px-3 py-1.5 text-xs rounded-lg border transition-all ${
                    selectedLanguage === lang
                      ? 'border-accent-500/50 bg-accent-500/10 text-accent-400 font-semibold'
                      : 'border-dark-800 bg-dark-900 text-dark-400 hover:text-dark-200 hover:border-dark-700'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Syncing State Toast */}
        {refreshing && (
          <div className="bg-accent-600/10 border border-accent-500/20 p-4 rounded-xl flex items-center gap-3 animate-pulse">
            <div className="relative">
              <div className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-accent-500 opacity-75"></div>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent-600"></span>
            </div>
            <p className="text-xs text-accent-400 font-medium">{refreshMessage}</p>
          </div>
        )}

        {/* Repos Cards List */}
        <div className="space-y-4">
          {loading ? (
            // Skeleton loader
            Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx} className="glass-card p-6 rounded-2xl space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 skeleton rounded-full" />
                  <div className="space-y-1.5 flex-grow">
                    <div className="h-4 w-1/4 skeleton" />
                    <div className="h-3 w-1/6 skeleton" />
                  </div>
                </div>
                <div className="h-3 w-full skeleton" />
                <div className="h-3 w-3/4 skeleton" />
              </div>
            ))
          ) : filteredRepos.length === 0 ? (
            <div className="glass-card p-12 rounded-2xl text-center space-y-3">
              <Search className="h-10 w-10 text-dark-500 mx-auto" />
              <h3 className="text-dark-300 font-semibold">No trending repositories found</h3>
              <p className="text-dark-400 text-xs max-w-sm mx-auto">
                No repositories match your current filters. Try selecting a different language or search query.
              </p>
            </div>
          ) : (
            filteredRepos.map((repo, idx) => {
              const bookmarked = isBookmarked(repo.full_name);
              const isExpanded = expandedRepo === repo.full_name;
              
              return (
                <div 
                  key={repo.id || `${repo.full_name}-${idx}`} 
                  className={`glass-card rounded-2xl overflow-hidden glass-card-hover ${
                    isExpanded ? 'border-accent-500/30' : ''
                  }`}
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      
                      {/* Left: Avatar + Title & Meta */}
                      <div className="flex gap-4 items-start">
                        <img 
                          src={repo.owner_avatar} 
                          alt={repo.owner} 
                          onError={(e) => {
                            e.target.onerror = null; 
                            e.target.src = `https://github.com/${repo.owner}.png`;
                          }}
                          className="w-10 h-10 rounded-xl bg-dark-900 border border-dark-800 object-cover"
                        />
                        
                        <div>
                          <h3 className="text-base font-semibold text-dark-100 flex items-center flex-wrap gap-1">
                            <span className="text-dark-400 font-normal hover:underline cursor-pointer">
                              <a href={`https://github.com/${repo.owner}`} target="_blank" rel="noreferrer">
                                {repo.owner}
                              </a>
                            </span>
                            <span className="text-dark-500 font-normal">/</span>
                            <span className="hover:underline cursor-pointer text-accent-400">
                              <a href={`https://github.com/${repo.owner}/${repo.repo_name}`} target="_blank" rel="noreferrer">
                                {repo.repo_name}
                              </a>
                            </span>
                          </h3>
                          
                          {/* Tags row */}
                          <div className="flex items-center gap-4 mt-2">
                            {repo.language && (
                              <div className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${getLanguageColor(repo.language)} shadow-sm`}></span>
                                <span className="text-xs text-dark-300 font-medium">{repo.language}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1 text-xs text-dark-400">
                              <Star className="h-3.5 w-3.5 fill-dark-500 stroke-dark-500" />
                              <span>{repo.stars.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-dark-400">
                              <GitFork className="h-3.5 w-3.5 text-dark-500" />
                              <span>{repo.forks.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions (Watchlist / Expand) */}
                      <div className="flex items-center gap-2">
                        {/* Watchlist Toggle */}
                        <button
                          onClick={() => onToggleWatchlist(repo)}
                          title={bookmarked ? "Remove from watchlist" : "Add to watchlist"}
                          className={`p-2 rounded-xl border transition-all ${
                            bookmarked 
                              ? 'bg-accent-600/10 border-accent-500/20 text-accent-400 hover:bg-accent-600/20' 
                              : 'bg-dark-900 border-dark-800 text-dark-400 hover:text-dark-200 hover:border-dark-700'
                          }`}
                        >
                          {bookmarked ? <Trash2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                        </button>
                        
                        {/* History Expand */}
                        <button
                          onClick={() => handleExpandRepo(repo.full_name)}
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

                    {/* Description */}
                    {repo.description && (
                      <p className="mt-3.5 text-sm text-dark-400 leading-relaxed font-normal">
                        {repo.description}
                      </p>
                    )}

                    {/* Star gain tag (Period dependent) */}
                    {repo.stars_today > 0 && (
                      <div className="mt-4 flex items-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-success-600/10 text-success-500 border border-success-600/10">
                          +{repo.stars_today.toLocaleString()} stars {selectedTimeRange === 'daily' ? 'today' : selectedTimeRange === 'weekly' ? 'this week' : 'this month'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Expanded: Growth Chart */}
                  {isExpanded && (
                    <div className="border-t border-dark-850 p-6 bg-dark-950/40">
                      <TrendChart 
                        repoName={repo.full_name} 
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

      {/* RISING FAST SIDEBAR PANEL (Span 1 on large screens) */}
      <div className="space-y-6">
        <div className="glass-card p-6 rounded-2xl space-y-6 relative overflow-hidden">
          {/* Subtle soft backdrop effect */}
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="flex items-center gap-2 border-b border-dark-800 pb-4">
            <Flame className="h-5 w-5 text-orange-500 animate-pulse" />
            <h3 className="text-base font-bold text-dark-200">Rising Fast (7d)</h3>
          </div>

          <div className="space-y-4">
            {risingLoading ? (
              // Skeleton loading sidebar
              Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="flex gap-3 items-center">
                  <div className="w-8 h-8 skeleton rounded-lg" />
                  <div className="space-y-1 flex-grow">
                    <div className="h-3 w-3/4 skeleton" />
                    <div className="h-2 w-1/2 skeleton" />
                  </div>
                </div>
              ))
            ) : risingRepos.length === 0 ? (
              <p className="text-xs text-dark-500 text-center py-4">No recent star growth history logs.</p>
            ) : (
              risingRepos.map((repo, idx) => (
                <div 
                  key={repo.id || `${repo.full_name}-rising-${idx}`} 
                  onClick={() => handleExpandRepo(repo.full_name)}
                  className="group flex gap-3 items-center justify-between p-2 rounded-xl hover:bg-dark-900 border border-transparent hover:border-dark-800 transition-all cursor-pointer"
                >
                  <div className="flex gap-2.5 items-center min-w-0">
                    <img 
                      src={repo.owner_avatar} 
                      alt={repo.owner} 
                      className="w-8 h-8 rounded-lg bg-dark-950 border border-dark-850 object-cover flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-dark-200 group-hover:text-accent-400 truncate transition-colors">
                        {repo.repo_name}
                      </p>
                      <p className="text-[10px] text-dark-500 truncate">
                        {repo.owner}
                      </p>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600/10 text-emerald-500 border border-emerald-500/10">
                      +{repo.stars_today.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
