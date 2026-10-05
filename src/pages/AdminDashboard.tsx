import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useComplaints } from '../context/ComplaintContext';
import type { Complaint, Department, ComplaintStatus } from '../types';
import { PriorityBadge } from '../components/common/PriorityBadge';
import { CategoryIcon } from '../components/common/CategoryIcon';
import { HotspotMap } from '../components/admin/HotspotMap';
import { AIInsights } from '../components/admin/AIInsights';
import { DepartmentOverview, SIX_CORE_DEPARTMENTS } from '../components/admin/DepartmentOverview';
import { AdminAssignModal, CORE_DEPARTMENTS } from '../components/admin/AdminAssignModal';
import { AdminEscalationView } from '../components/admin/AdminEscalationView';
import {
  LayoutDashboard,
  FileSpreadsheet,
  Sparkles,
  Map as MapIcon,
  Building2,
  AlertCircle,
  Clock,
  CheckCircle2,
  RefreshCw,
  Search,
  Shield,
  ChevronLeft,
  ChevronRight,
  Home,
  Flame,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';

export type AdminTab =
  | 'overview'
  | 'complaints'
  | 'ai-insights'
  | 'hotspot-map'
  | 'departments'
  | 'escalations';

const PRIORITY_PIE_COLORS: Record<string, string> = {
  High: '#e11d48',
  Medium: '#f59e0b',
  Low: '#10b981',
};

export const AdminDashboard: React.FC = () => {
  const {
    complaints,
    adminUpdateComplaint,
    adminReassignComplaint,
    adminEscalateComplaint,
    adminSendNotice,
    refreshComplaints,
    isLoading,
  } = useComplaints();

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [selectedComplaintForAssign, setSelectedComplaintForAssign] = useState<Complaint | null>(null);
  const [focusedMapComplaint, setFocusedMapComplaint] = useState<Complaint | null>(null);

  // Table Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [wardFilter, setWardFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Key KPI Metrics (Municipality-wide)
  const metrics = useMemo(() => {
    const total = complaints.length;
    const pending = complaints.filter((c) => c.status === 'Pending').length;
    const inProgress = complaints.filter((c) => c.status === 'In Progress').length;
    const resolved = complaints.filter((c) => c.status === 'Resolved').length;
    const highPriority = complaints.filter((c) => c.priority === 'High').length;
    const escalated = complaints.filter((c) => c.escalated).length;
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    return {
      total,
      pending,
      inProgress,
      resolved,
      highPriority,
      escalated,
      resolutionRate,
    };
  }, [complaints]);

  // Overview Charts Data
  const trendData = useMemo(() => {
    const datesMap: Record<string, { date: string; total: number; resolved: number }> = {};
    const sorted = [...complaints].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    sorted.forEach((c) => {
      const d = new Date(c.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      if (!datesMap[d]) {
        datesMap[d] = { date: d, total: 0, resolved: 0 };
      }
      datesMap[d].total++;
      if (c.status === 'Resolved') datesMap[d].resolved++;
    });

    return Object.values(datesMap);
  }, [complaints]);

  const priorityData = useMemo(() => {
    const counts: Record<string, number> = { High: 0, Medium: 0, Low: 0 };
    complaints.forEach((c) => {
      counts[c.priority] = (counts[c.priority] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
      color: PRIORITY_PIE_COLORS[name] || '#94a3b8',
    }));
  }, [complaints]);

  const departmentWorkloadData = useMemo(() => {
    return SIX_CORE_DEPARTMENTS.map((dept) => {
      const count = complaints.filter((c) => dept.aliases.includes(c.department)).length;
      return {
        name: dept.name.split(' ')[0], // short name
        fullName: dept.name,
        count,
      };
    });
  }, [complaints]);

  // Wards list for filter
  const allWards = useMemo(() => {
    const wards = new Set<string>();
    complaints.forEach((c) => {
      if (c.location.ward) wards.add(c.location.ward);
    });
    return Array.from(wards);
  }, [complaints]);

  // Filtered complaints for Complaint Management Table
  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = c.id.toLowerCase().includes(q);
        const matchesDesc = c.description.toLowerCase().includes(q);
        const matchesAddr = c.location.address.toLowerCase().includes(q);
        const matchesCategory = c.category.toLowerCase().includes(q);
        if (!matchesId && !matchesDesc && !matchesAddr && !matchesCategory) {
          return false;
        }
      }

      // Status
      if (statusFilter !== 'all' && c.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }

      // Priority
      if (priorityFilter !== 'all' && c.priority.toLowerCase() !== priorityFilter.toLowerCase()) {
        return false;
      }

      // Department
      if (departmentFilter !== 'all' && c.department !== departmentFilter) {
        return false;
      }

      // Category
      if (categoryFilter !== 'all' && c.category !== categoryFilter) {
        return false;
      }

      // Ward
      if (wardFilter !== 'all' && c.location.ward !== wardFilter) {
        return false;
      }

      return true;
    });
  }, [complaints, searchQuery, statusFilter, priorityFilter, departmentFilter, categoryFilter, wardFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredComplaints.length / pageSize) || 1;
  const paginatedComplaints = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredComplaints.slice(start, start + pageSize);
  }, [filteredComplaints, currentPage, pageSize]);

  // Admin Handlers
  const handleAssignSubmit = (
    id: string,
    department: Department,
    officerName?: string,
    notes?: string
  ) => {
    adminReassignComplaint(id, department, officerName, notes);
    setSelectedComplaintForAssign(null);
  };

  const handleEscalateSubmit = (id: string, reason: string) => {
    adminEscalateComplaint(id, reason);
  };

  const handleViewOnMap = (complaint: Complaint) => {
    setFocusedMapComplaint(complaint);
    setActiveTab('hotspot-map');
  };

  const handleFilterByDepartment = (dept: Department) => {
    setDepartmentFilter(dept);
    setActiveTab('complaints');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col md:flex-row animate-in fade-in duration-200">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-slate-900 text-white flex-shrink-0 flex flex-col justify-between border-r border-slate-800">
        <div>
          {/* Admin Command Center Branding */}
          <div className="p-6 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <span className="font-extrabold text-sm sm:text-base tracking-tight block">
                  Municipal<span className="text-sky-400">Admin</span>
                </span>
                <span className="text-[10px] text-slate-400 font-medium block">
                  City Command Center
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Links (6 Modules) */}
          <nav className="p-4 space-y-1.5 text-xs font-semibold">
            {/* 1. Overview */}
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl transition cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Overview</span>
            </button>

            {/* 2. Complaint Management */}
            <button
              type="button"
              onClick={() => setActiveTab('complaints')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl transition cursor-pointer ${
                activeTab === 'complaints'
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-4 h-4" />
                <span>Complaints</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                {complaints.length}
              </span>
            </button>

            {/* 3. AI Insights */}
            <button
              type="button"
              onClick={() => setActiveTab('ai-insights')}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl transition cursor-pointer ${
                activeTab === 'ai-insights'
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Sparkles className="w-4 h-4 text-sky-400" />
              <span>AI Insights</span>
            </button>

            {/* 4. Hotspot Map */}
            <button
              type="button"
              onClick={() => setActiveTab('hotspot-map')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl transition cursor-pointer ${
                activeTab === 'hotspot-map'
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <MapIcon className="w-4 h-4 text-rose-400" />
                <span>Hotspot Map</span>
              </div>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300">
                DBSCAN
              </span>
            </button>

            {/* 5. Departments */}
            <button
              type="button"
              onClick={() => setActiveTab('departments')}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl transition cursor-pointer ${
                activeTab === 'departments'
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Departments</span>
            </button>

            {/* 6. Escalation & SLA */}
            <button
              type="button"
              onClick={() => setActiveTab('escalations')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl transition cursor-pointer ${
                activeTab === 'escalations'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                  : 'text-rose-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <ShieldAlert className="w-4 h-4" />
                <span>Escalations & SLA</span>
              </div>
              {metrics.escalated > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500 text-white">
                  {metrics.escalated}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Sidebar Footer & Role Switchers */}
        <div className="p-4 border-t border-slate-800/80 space-y-2">
          <Link
            to="/officer"
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-xl text-xs font-bold transition border border-amber-500/30"
          >
            <Wrench className="w-4 h-4 text-amber-400" />
            <span>Officer Portal</span>
          </Link>

          <Link
            to="/"
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Citizen Portal</span>
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
          <div>
            <span className="text-[10px] font-bold text-sky-700 uppercase tracking-wider bg-sky-50 px-2 py-0.5 rounded-md">
              Admin Command
            </span>
            <h1 className="text-xl font-black text-slate-900 tracking-tight mt-1">
              {activeTab === 'overview' && 'Administrative Overview'}
              {activeTab === 'complaints' && 'Complaint Management'}
              {activeTab === 'ai-insights' && 'AI Analytics'}
              {activeTab === 'hotspot-map' && 'Hotspot Map (DBSCAN)'}
              {activeTab === 'departments' && 'Department Overview'}
              {activeTab === 'escalations' && 'Escalation & SLA Monitoring'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => refreshComplaints()}
              disabled={isLoading}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              title="Sync Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sync</span>
            </button>

            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Feed
            </span>
          </div>
        </header>

        {/* Tab Content Body */}
        <div className="p-6 space-y-6 flex-1">
          {/* ==================================================== */}
          {/* TAB 1: OVERVIEW                                      */}
          {/* ==================================================== */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* 6 Main KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider">Total</span>
                    <FileSpreadsheet className="w-4 h-4 text-sky-600" />
                  </div>
                  <div className="text-2xl font-black text-slate-900">{metrics.total}</div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-amber-600">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider">Pending</span>
                    <Clock className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="text-2xl font-black text-amber-800">{metrics.pending}</div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-indigo-200 bg-indigo-50/20 shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-indigo-600">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider">In Progress</span>
                    <RefreshCw className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div className="text-2xl font-black text-indigo-800">{metrics.inProgress}</div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-emerald-600">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider">Resolved</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="text-2xl font-black text-emerald-800">{metrics.resolved}</div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-emerald-600">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider">SLA Rate</span>
                    <span className="text-xs font-black">📈</span>
                  </div>
                  <div className="text-2xl font-black text-emerald-700">{metrics.resolutionRate}%</div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-rose-200 bg-rose-50/30 shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-rose-600">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider">High Priority</span>
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                  </div>
                  <div className="text-2xl font-black text-rose-700">{metrics.highPriority}</div>
                </div>
              </div>

              {/* High-Density Area Indicator Banner */}
              <div className="p-3.5 sm:p-4 bg-gradient-to-r from-sky-600 to-indigo-700 rounded-2xl text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-sky-200 block">
                    Hotspot Detected
                  </span>
                  <h3 className="text-sm font-bold tracking-tight">
                    Spatial cluster in Anna Nagar (Ward 102)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('hotspot-map')}
                  className="px-3.5 py-1.5 bg-white hover:bg-sky-50 text-sky-900 font-bold text-xs rounded-xl shadow-xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                >
                  <Flame className="w-3.5 h-3.5 text-rose-600" />
                  <span>View Map</span>
                </button>
              </div>

              {/* Charts Grid: Volume Trend + Priority Breakdown + Department Workload */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* 1. Trend Over Time */}
                <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3 lg:col-span-2">
                  <h3 className="font-extrabold text-slate-900 text-sm">Grievance Trends</h3>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData}>
                        <defs>
                          <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                          </linearGradient>
                          <linearGradient id="resolvedGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                        <Tooltip />
                        <Area type="monotone" dataKey="total" name="Total Logged" stroke="#0284c7" strokeWidth={2} fill="url(#totalGrad)" />
                        <Area type="monotone" dataKey="resolved" name="Resolved" stroke="#10b981" strokeWidth={2} fill="url(#resolvedGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 2. Priority Distribution */}
                <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between">
                  <h3 className="font-extrabold text-slate-900 text-sm">Priority Breakdown</h3>
                  <div className="h-40 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={priorityData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={50}
                          innerRadius={28}
                          paddingAngle={4}
                        >
                          {priorityData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-center text-xs">
                    {priorityData.map((p) => (
                      <div key={p.name} className="p-1.5 bg-slate-50 rounded-xl">
                        <span className="text-[10px] text-slate-400 block font-bold">{p.name}</span>
                        <span className="font-black text-slate-800">{p.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Department Workload Summary Bar */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h3 className="font-extrabold text-slate-900 text-sm">Department Workload</h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('departments')}
                    className="text-xs text-sky-600 font-bold hover:underline"
                  >
                    View Departments →
                  </button>
                </div>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={departmentWorkloadData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" name="Complaints" fill="#6366f1" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Recent Complaints Requiring Administrative Attention */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h3 className="font-extrabold text-slate-900 text-sm">
                    Recent Attention Queue
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('complaints')}
                    className="text-xs text-sky-600 font-bold hover:underline"
                  >
                    View All →
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-slate-400 uppercase text-[10px] font-bold border-b border-slate-100">
                        <th className="pb-3">Ticket ID</th>
                        <th className="pb-3">Category</th>
                        <th className="pb-3">Location</th>
                        <th className="pb-3">Priority</th>
                        <th className="pb-3">Department</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {complaints.slice(0, 5).map((comp) => (
                        <tr key={comp.id} className="hover:bg-slate-50 transition">
                          <td className="py-3 font-bold text-slate-900 font-mono">{comp.id}</td>
                          <td className="py-3 font-semibold text-slate-800">{comp.category}</td>
                          <td className="py-3 text-slate-600 max-w-[180px] truncate">{comp.location.address}</td>
                          <td className="py-3">
                            <PriorityBadge priority={comp.priority} size="sm" />
                          </td>
                          <td className="py-3 text-slate-700 font-medium">{comp.department}</td>
                          <td className="py-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                              {comp.status}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedComplaintForAssign(comp)}
                              className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold rounded-xl transition cursor-pointer text-xs"
                            >
                              Assign
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 2: COMPLAINT MANAGEMENT (Administrative Level)  */}
          {/* ==================================================== */}
          {activeTab === 'complaints' && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
              {/* Header & Multi-Filter Bar */}
              <div className="space-y-3 pb-4 border-b border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h2 className="font-extrabold text-slate-900 text-base">
                    Administrative Complaint Triage
                  </h2>
                  <div className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl self-start sm:self-auto">
                    Total: {filteredComplaints.length}
                  </div>
                </div>

                {/* Filter Controls Row */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
                  {/* Search */}
                  <div className="relative col-span-2 sm:col-span-1 lg:col-span-2">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search ID, street, category..."
                      className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    />
                  </div>

                  {/* Status Filter */}
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-2.5 py-2 text-xs font-semibold focus:outline-none"
                  >
                    <option value="all">All Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Rejected">Rejected</option>
                  </select>

                  {/* Priority Filter */}
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-2.5 py-2 text-xs font-semibold focus:outline-none"
                  >
                    <option value="all">All Priorities</option>
                    <option value="High">High Priority</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="Low">Low Priority</option>
                  </select>

                  {/* Department Filter */}
                  <select
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-2.5 py-2 text-xs font-semibold focus:outline-none"
                  >
                    <option value="all">All Departments</option>
                    {CORE_DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>

                  {/* Category Filter */}
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-2.5 py-2 text-xs font-semibold focus:outline-none"
                  >
                    <option value="all">All Categories</option>
                    <option value="Pothole">Pothole</option>
                    <option value="Streetlight">Streetlight</option>
                    <option value="Water Supply">Water Supply</option>
                    <option value="Drainage">Drainage</option>
                    <option value="Garbage">Garbage</option>
                    <option value="Traffic">Traffic</option>
                    <option value="Public Health">Public Health</option>
                    <option value="Tree Fall">Tree Fall</option>
                    <option value="Other">Other</option>
                  </select>

                  {/* Ward Filter */}
                  <select
                    value={wardFilter}
                    onChange={(e) => setWardFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-2.5 py-2 text-xs font-semibold focus:outline-none"
                  >
                    <option value="all">All Wards</option>
                    {allWards.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Triage Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-slate-400 uppercase text-[10px] font-bold border-b border-slate-100">
                      <th className="pb-3">Ticket ID</th>
                      <th className="pb-3">Category</th>
                      <th className="pb-3">Location & Ward</th>
                      <th className="pb-3">Priority</th>
                      <th className="pb-3">Assigned Division & Officer</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3 text-right">Admin Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedComplaints.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400">
                          No municipal complaints found matching the current filters.
                        </td>
                      </tr>
                    ) : (
                      paginatedComplaints.map((comp) => (
                        <tr key={comp.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3.5 font-bold font-mono text-slate-900">
                            {comp.id}
                            {comp.escalated && (
                              <span className="block text-[9px] text-rose-600 font-extrabold uppercase">
                                Escalated
                              </span>
                            )}
                          </td>
                          <td className="py-3.5">
                            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                              <CategoryIcon category={comp.category} className="w-4 h-4" />
                              <span>{comp.category}</span>
                            </div>
                          </td>
                          <td className="py-3.5 max-w-[180px] truncate text-slate-600">
                            <span className="truncate block">{comp.location.address}</span>
                            <span className="text-[10px] text-slate-400 font-semibold">
                              {comp.location.ward || 'Ward 102'}
                            </span>
                          </td>
                          <td className="py-3.5">
                            <PriorityBadge priority={comp.priority} size="sm" />
                          </td>
                          <td className="py-3.5 text-slate-700">
                            <span className="font-semibold block">{comp.department}</span>
                            <span className="text-[10px] text-slate-400">
                              {comp.assignedOfficer || 'Field Crew Assigned'}
                            </span>
                          </td>
                          <td className="py-3.5">
                            <select
                              value={comp.status}
                              onChange={(e) =>
                                adminUpdateComplaint(comp.id, {
                                  status: e.target.value as ComplaintStatus,
                                })
                              }
                              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition cursor-pointer focus:outline-none ${
                                comp.status === 'Resolved'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                  : comp.status === 'In Progress'
                                  ? 'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100'
                                  : comp.status === 'Rejected'
                                  ? 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                                  : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                              }`}
                              title="Click to update complaint status"
                            >
                              <option value="Pending">Pending</option>
                              <option value="In Progress">In Progress</option>
                              <option value="Resolved">Resolved</option>
                              <option value="Rejected">Rejected</option>
                            </select>
                          </td>
                          <td className="py-3.5 text-right space-x-1.5">
                            <button
                              type="button"
                              onClick={() => handleViewOnMap(comp)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer text-xs"
                              title="Locate on DBSCAN Hotspot Map"
                            >
                              <MapIcon className="w-3.5 h-3.5 inline mr-1" />
                              Map
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedComplaintForAssign(comp)}
                              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer text-xs"
                              title="Assign or Reassign Department/Officer"
                            >
                              Assign / Reassign
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                  <span className="text-slate-400">
                    Page {currentPage} of {totalPages}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 3: AI INSIGHTS                                  */}
          {/* ==================================================== */}
          {activeTab === 'ai-insights' && (
            <AIInsights complaints={complaints} onSelectComplaint={(c) => setSelectedComplaintForAssign(c)} />
          )}

          {/* ==================================================== */}
          {/* TAB 4: HOTSPOT MAP (DBSCAN)                          */}
          {/* ==================================================== */}
          {activeTab === 'hotspot-map' && (
            <HotspotMap
              complaints={complaints}
              focusedComplaint={focusedMapComplaint}
              onSelectComplaint={(c) => setSelectedComplaintForAssign(c)}
            />
          )}

          {/* ==================================================== */}
          {/* TAB 5: DEPARTMENTS                                  */}
          {/* ==================================================== */}
          {activeTab === 'departments' && (
            <DepartmentOverview
              complaints={complaints}
              onFilterByDepartment={handleFilterByDepartment}
            />
          )}

          {/* ==================================================== */}
          {/* TAB 6: ESCALATIONS & SLA MONITORING                 */}
          {/* ==================================================== */}
          {activeTab === 'escalations' && (
            <AdminEscalationView
              complaints={complaints}
              onReassignComplaint={(c) => setSelectedComplaintForAssign(c)}
              onEscalateComplaint={handleEscalateSubmit}
              onSendNotice={(id, msg) => adminSendNotice(id, msg)}
            />
          )}
        </div>
      </main>

      {/* Administrative Assignment Modal */}
      {selectedComplaintForAssign && (
        <AdminAssignModal
          complaint={selectedComplaintForAssign}
          onClose={() => setSelectedComplaintForAssign(null)}
          onAssign={handleAssignSubmit}
          onEscalate={handleEscalateSubmit}
        />
      )}
    </div>
  );
};
