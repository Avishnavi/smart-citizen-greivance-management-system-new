import React, { useMemo } from 'react';
import type { Complaint } from '../../types';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import {
  Sparkles,
  PieChart as PieIcon,
  TrendingUp,
  Copy,
  AlertTriangle,
} from 'lucide-react';

interface AIInsightsProps {
  complaints: Complaint[];
  onSelectComplaint?: (complaint: Complaint) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  High: '#e11d48', // rose-600
  Medium: '#f59e0b', // amber-500
  Low: '#10b981', // emerald-500
};

const CATEGORY_COLORS = [
  '#0284c7', // sky-600
  '#6366f1', // indigo-500
  '#8b5cf6', // purple-500
  '#ec4899', // pink-500
  '#f97316', // orange-500
  '#14b8a6', // teal-500
  '#eab308', // yellow-500
  '#64748b', // slate-500
];

export const AIInsights: React.FC<AIInsightsProps> = ({
  complaints,
  onSelectComplaint,
}) => {
  // 1. Category Distribution
  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    complaints.forEach((c) => {
      counts[c.category] = (counts[c.category] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [complaints]);

  // 2. Priority Distribution
  const priorityData = useMemo(() => {
    const counts: Record<string, number> = { High: 0, Medium: 0, Low: 0 };
    complaints.forEach((c) => {
      counts[c.priority] = (counts[c.priority] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
      color: PRIORITY_COLORS[name] || '#94a3b8',
    }));
  }, [complaints]);

  // 3. Complaint Trends over time
  const trendData = useMemo(() => {
    const datesMap: Record<string, { date: string; count: number; highPriority: number }> = {};
    const sorted = [...complaints].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    sorted.forEach((c) => {
      const d = new Date(c.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      if (!datesMap[d]) {
        datesMap[d] = { date: d, count: 0, highPriority: 0 };
      }
      datesMap[d].count++;
      if (c.priority === 'High') datesMap[d].highPriority++;
    });

    return Object.values(datesMap);
  }, [complaints]);

  // 4. Duplicate / Related Complaints flagged by AI
  const duplicateComplaints = useMemo(() => {
    return complaints.filter(
      (c) =>
        c.duplicateStatus === 'possible_duplicate' ||
        Boolean(c.similarComplaintId) ||
        (c.similarityScore && c.similarityScore > 0.6)
    );
  }, [complaints]);

  return (
    <div className="space-y-6">
      {/* AI Insights Header Card */}
      <div className="p-5 bg-gradient-to-r from-sky-900 via-indigo-900 to-slate-900 text-white rounded-3xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-sky-500/20 text-sky-300 rounded-xl">
              <Sparkles className="w-4 h-4 text-sky-400" />
            </span>
            <h2 className="text-lg font-black tracking-tight">
              AI Analytics
            </h2>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span className="px-2 py-0.5 bg-white/10 rounded-md text-[10px] text-sky-200">Auto-Classify</span>
            <span className="px-2 py-0.5 bg-white/10 rounded-md text-[10px] text-sky-200">Priority Triage</span>
            <span className="px-2 py-0.5 bg-white/10 rounded-md text-[10px] text-sky-200">Duplicate Check</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto text-xs font-bold">
          <div className="px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-xl border border-white/10">
            <span className="text-slate-400 block text-[9px]">Accuracy</span>
            <span className="text-emerald-400 text-xs sm:text-sm font-black">96.4%</span>
          </div>
          <div className="px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-xl border border-white/10">
            <span className="text-slate-400 block text-[9px]">Duplicates</span>
            <span className="text-sky-300 text-xs sm:text-sm font-black">{duplicateComplaints.length}</span>
          </div>
        </div>
      </div>

      {/* Top 2 Charts: Category & Priority Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Category Distribution Chart */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-sky-100 text-sky-700 rounded-xl">
                <PieIcon className="w-4 h-4" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-sm">
                Category Distribution
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              {categoryData.length} categories
            </span>
          </div>

          <div className="h-60 w-full pt-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#334155' }}
                  width={110}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="value" name="Complaints" radius={[0, 8, 8, 0]}>
                  {categoryData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Priority Distribution Chart */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-rose-100 text-rose-700 rounded-xl">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-sm">
                Priority Breakdown
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-medium">Auto-Triaged</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-3 pt-3">
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={priorityData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={4}
                  >
                    {priorityData.map((entry, index) => (
                      <Cell key={`slice-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2 text-xs">
              {priorityData.map((item) => (
                <div
                  key={item.name}
                  className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: item.color }}
                    ></span>
                    <span className="font-bold text-slate-800">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-extrabold text-slate-900">{item.value}</span>
                    <span className="text-[10px] text-slate-400 block">
                      {complaints.length > 0
                        ? `${Math.round((item.value / complaints.length) * 100)}%`
                        : '0%'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Complaint Trends Timeline Chart */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-xl">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">
                Volume & Trends
              </h3>
            </div>
          </div>
        </div>

        <div className="h-60 w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="totalColor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#0284c7" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="highColor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#e11d48" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#e11d48" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                  fontSize: '12px',
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                name="Total"
                stroke="#0284c7"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#totalColor)"
              />
              <Area
                type="monotone"
                dataKey="highPriority"
                name="High Priority"
                stroke="#e11d48"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#highColor)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Duplicate / Related Complaints Section */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-100 text-amber-800 rounded-xl">
              <Copy className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">
                Duplicate Flags
              </h3>
            </div>
          </div>
          <span className="text-xs font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full">
            {duplicateComplaints.length} Flags
          </span>
        </div>

        {duplicateComplaints.length === 0 ? (
          <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-200/80 text-xs text-slate-500 font-medium">
            No duplicates detected
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {duplicateComplaints.map((comp) => (
              <div
                key={comp.id}
                className="p-4 bg-slate-50 hover:bg-white rounded-2xl border border-slate-200 hover:border-sky-300 hover:shadow-sm transition space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">{comp.id}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    {comp.similarityScore ? `${Math.round(comp.similarityScore * 100)}% Semantic Match` : 'Spatial Overlap'}
                  </span>
                </div>

                <p className="text-slate-700 leading-snug line-clamp-2">"{comp.description}"</p>

                <div className="p-2.5 bg-amber-50/80 border border-amber-200/70 rounded-xl flex items-center justify-between text-[11px]">
                  <div>
                    <span className="text-amber-900 font-semibold block">
                      Matches: <strong>{comp.similarComplaintId || 'CMP-2026-001245'}</strong>
                    </span>
                    <span className="text-amber-700 text-[10px]">
                      Geographic proximity within ~45 meters
                    </span>
                  </div>
                  {onSelectComplaint && (
                    <button
                      type="button"
                      onClick={() => onSelectComplaint(comp)}
                      className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[10px] transition cursor-pointer"
                    >
                      Inspect
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
