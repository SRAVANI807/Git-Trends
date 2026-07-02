import React, { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { TrendingUp, GitFork, Star } from 'lucide-react';

export default function TrendChart({ repoName, data, loading }) {
  const [metric, setMetric] = useState('stars'); // 'stars' or 'forks'

  if (loading) {
    return (
      <div className="glass-card p-6 rounded-2xl flex flex-col items-center justify-center h-[360px]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-accent-500"></div>
        <p className="text-dark-400 mt-4 font-medium animate-pulse text-sm">Loading historical data...</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="glass-card p-6 rounded-2xl flex flex-col items-center justify-center h-[360px] text-center">
        <TrendingUp className="h-10 w-10 text-dark-500 mb-2" />
        <p className="text-dark-300 font-semibold">No snapshot history found</p>
        <p className="text-dark-400 text-xs mt-1 max-w-xs">
          We need at least two snapshots over time to draw a trend. Try checking back in later or refreshing!
        </p>
      </div>
    );
  }

  // Format date labels nicely
  const formattedData = data.map((item) => {
    const dateObj = new Date(item.date);
    return {
      ...item,
      // Format to "MMM DD" (e.g. "Jun 28")
      formattedDate: dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
    };
  });

  const customTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-dark-900 border border-dark-700 p-3 rounded-xl shadow-xl text-xs font-sans">
          <p className="text-dark-300 font-semibold mb-1">{label}</p>
          {payload.map((p, index) => (
            <p key={index} className="flex items-center gap-1.5 font-medium" style={{ color: p.color }}>
              {p.name === 'stars' ? <Star className="h-3 w-3 fill-current" /> : <GitFork className="h-3 w-3" />}
              {p.name.charAt(0).toUpperCase() + p.name.slice(1)}: {p.value.toLocaleString()}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const activeColor = metric === 'stars' ? '#818cf8' : '#34d399';

  return (
    <div className="glass-card p-6 rounded-2xl flex flex-col h-[380px] justify-between relative overflow-hidden">
      {/* Background soft glow */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-accent-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 z-10">
        <div>
          <h3 className="text-sm font-semibold text-dark-300 uppercase tracking-wider">Growth Trend Analysis</h3>
          <p className="text-xs text-dark-400 mt-0.5">Visualizing star & fork velocity for {repoName}</p>
        </div>

        {/* Metric Selector Buttons */}
        <div className="flex items-center bg-dark-900 border border-dark-800 rounded-lg p-1">
          <button
            onClick={() => setMetric('stars')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-md transition-all ${
              metric === 'stars'
                ? 'bg-accent-600 text-white font-medium shadow-md shadow-accent-600/30'
                : 'text-dark-400 hover:text-dark-200'
            }`}
          >
            <Star className="h-3.5 w-3.5" />
            Stars
          </button>
          <button
            onClick={() => setMetric('forks')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-md transition-all ${
              metric === 'forks'
                ? 'bg-success-600 text-white font-medium shadow-md shadow-success-600/30'
                : 'text-dark-400 hover:text-dark-200'
            }`}
          >
            <GitFork className="h-3.5 w-3.5" />
            Forks
          </button>
        </div>
      </div>

      <div className="w-full flex-grow z-10" style={{ height: '240px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="starsColor" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#818cf8" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="forksColor" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34d399" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="formattedDate"
              stroke="#64748b"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              dy={10}
            />
            <YAxis
              stroke="#64748b"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => val.toLocaleString()}
            />
            <Tooltip content={customTooltip} cursor={{ stroke: '#334155', strokeWidth: 1 }} />
            <Line
              type="monotone"
              dataKey={metric}
              name={metric}
              stroke={activeColor}
              strokeWidth={3}
              activeDot={{ r: 6, stroke: '#0f172a', strokeWidth: 2 }}
              dot={{ r: 2 }}
              animationDuration={500}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
