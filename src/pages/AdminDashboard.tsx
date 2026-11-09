import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useComplaints } from '../context/ComplaintContext';
import type { Complaint, Department, ComplaintStatus, RecurringIssueHotspot, HotspotMetrics, KnowledgeDocument } from '../types';
import { parseSafeDate } from '../utils/dateUtils';
import { PriorityBadge } from '../components/common/PriorityBadge';
import { CategoryIcon } from '../components/common/CategoryIcon';
import { HotspotMap } from '../components/admin/HotspotMap';
import { AIInsights } from '../components/admin/AIInsights';
import { DepartmentOverview, SIX_CORE_DEPARTMENTS } from '../components/admin/DepartmentOverview';
import { AdminAssignModal, CORE_DEPARTMENTS } from '../components/admin/AdminAssignModal';
import { AdminEscalationView } from '../components/admin/AdminEscalationView';
import { StaffProvisionModal } from '../components/admin/StaffProvisionModal';
import {
  approveComplaintApi,
  closeComplaintApi,
  fetchHotspotsApi,
  fetchHotspotMetricsApi,
  runHotspotScanApi,
  updateHotspotStatusApi,
} from '../services/complaintService';
import { fetchKnowledgeDocuments } from '../services/knowledgeService';
import { fetchApi } from '../services/api';
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
  Flame,
  ShieldAlert,
  Wrench,
  UserPlus,
  TrendingUp,
  TrendingDown,
  Minus,
  Check,
  X,
  BookOpen,
  LogOut,
  MessageSquare,
} from 'lucide-react';
import { AdminOfficialChatModal } from '../components/admin/AdminOfficialChatModal';
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
  | 'escalations'
  | 'knowledge';

const PRIORITY_PIE_COLORS: Record<string, string> = {
  High: '#e11d48',
  Medium: '#f59e0b',
  Low: '#10b981',
};

export const AdminDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
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
  const [selectedComplaintForChat, setSelectedComplaintForChat] = useState<Complaint | null>(null);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);

  const handleOpenChatModal = (complaint: Complaint) => {
    setSelectedComplaintForChat(complaint);
    setIsChatModalOpen(true);
  };
  const [focusedMapComplaint, setFocusedMapComplaint] = useState<Complaint | null>(null);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);

  // Table Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [wardFilter, setWardFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Hotspots State
  const [serverHotspots, setServerHotspots] = useState<RecurringIssueHotspot[]>([]);
  const [hotspotMetrics, setHotspotMetrics] = useState<HotspotMetrics | null>(null);
  const [hotspotsLoading, setHotspotsLoading] = useState(false);
  const [isScanningHotspots, setIsScanningHotspots] = useState(false);
  const [hotspotScanResult, setHotspotScanResult] = useState<any | null>(null);
  const [focusedHotspot, setFocusedHotspot] = useState<RecurringIssueHotspot | null>(null);
  const [selectedHotspotForAction, setSelectedHotspotForAction] = useState<RecurringIssueHotspot | null>(null);
  const [hotspotStatusFilter, setHotspotStatusFilter] = useState<string>('all');
  const [hotspotCategoryFilter, setHotspotCategoryFilter] = useState<string>('all');
  const [hotspotObservationWindow, setHotspotObservationWindow] = useState<number>(30);
  const [actionModalStatus, setActionModalStatus] = useState<string>('UNDER_REVIEW');
  const [actionModalProposedPlan, setActionModalProposedPlan] = useState<string>('');
  const [actionModalDept, setActionModalDept] = useState<string>('');
  const [actionModalNotes, setActionModalNotes] = useState<string>('');
  const [actionModalBudget, setActionModalBudget] = useState<string>('');
  const [isSubmittingAction, setIsSubmittingAction] = useState<boolean>(false);

  const loadHotspotData = React.useCallback(async () => {
    try {
      setHotspotsLoading(true);
      const [spots, hMetrics] = await Promise.all([
        fetchHotspotsApi({
          status: hotspotStatusFilter,
          category: hotspotCategoryFilter,
          observationWindowDays: hotspotObservationWindow,
        }),
        fetchHotspotMetricsApi(),
      ]);
      setServerHotspots(spots);
      if (hMetrics) setHotspotMetrics(hMetrics);
    } catch (err) {
      console.warn('Failed to load hotspots:', err);
    } finally {
      setHotspotsLoading(false);
    }
  }, [hotspotStatusFilter, hotspotCategoryFilter, hotspotObservationWindow]);

  React.useEffect(() => {
    if (activeTab === 'hotspot-map') {
      loadHotspotData();
    }
  }, [activeTab, loadHotspotData]);

  // Knowledge Documents / SOP State (M8)
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDocument[]>([]);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [knowledgeSearch, setKnowledgeSearch] = useState('');
  const [knowledgeDeptFilter, setKnowledgeDeptFilter] = useState('all');
  const [isReindexing, setIsReindexing] = useState(false);
  const [reindexMessage, setReindexMessage] = useState<string | null>(null);

  const loadKnowledgeDocs = React.useCallback(async () => {
    setKnowledgeLoading(true);
    try {
      const docs = await fetchKnowledgeDocuments({
        department: knowledgeDeptFilter !== 'all' ? knowledgeDeptFilter : undefined,
        search: knowledgeSearch || undefined,
      });
      setKnowledgeDocs(docs);
    } catch (err) {
      console.error('Failed to load knowledge documents:', err);
    } finally {
      setKnowledgeLoading(false);
    }
  }, [knowledgeDeptFilter, knowledgeSearch]);

  const handleReindexKnowledge = async () => {
    setIsReindexing(true);
    setReindexMessage(null);
    try {
      const res = await fetchApi<{ success: boolean; count: number }>('/knowledge/rechunk-all', {
        method: 'POST',
      });
      setReindexMessage(`Re-indexing complete: ${res?.count || 0} chunks updated.`);
      await loadKnowledgeDocs();
    } catch (err: any) {
      setReindexMessage(`Re-indexing failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsReindexing(false);
    }
  };

  React.useEffect(() => {
    if (activeTab === 'knowledge') {
      loadKnowledgeDocs();
    }
  }, [activeTab, loadKnowledgeDocs]);

  const handleTriggerScan = async () => {
    try {
      setIsScanningHotspots(true);
      setHotspotScanResult(null);
      const res = await runHotspotScanApi({
        observationWindowDays: hotspotObservationWindow,
      });
      setHotspotScanResult(res);
      await loadHotspotData();
      await refreshComplaints();
    } catch (err) {
      console.error('Scan error:', err);
    } finally {
      setIsScanningHotspots(false);
    }
  };

  const handleOpenActionModal = (h: RecurringIssueHotspot) => {
    setSelectedHotspotForAction(h);
    setActionModalStatus(h.status);
    setActionModalProposedPlan(h.preventiveActionPlan?.proposedAction || '');
    setActionModalDept(h.preventiveActionPlan?.responsibleDepartment || h.departmentName || '');
    setActionModalBudget(h.preventiveActionPlan?.budgetEstimated ? String(h.preventiveActionPlan.budgetEstimated) : '');
    setActionModalNotes('');
  };

  const handleSaveHotspotAction = async () => {
    if (!selectedHotspotForAction) return;
    try {
      setIsSubmittingAction(true);
      await updateHotspotStatusApi(selectedHotspotForAction._id, {
        status: actionModalStatus,
        proposedAction: actionModalProposedPlan,
        responsibleDepartment: actionModalDept,
        budgetEstimated: actionModalBudget ? Number(actionModalBudget) : undefined,
        notes: actionModalNotes,
      });
      setSelectedHotspotForAction(null);
      await loadHotspotData();
    } catch (err) {
      console.error('Failed to update hotspot:', err);
    } finally {
      setIsSubmittingAction(false);
    }
  };

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
    const sorted = [...complaints].sort((a, b) => {
      const ta = parseSafeDate(a.createdAt)?.getTime() || 0;
      const tb = parseSafeDate(b.createdAt)?.getTime() || 0;
      return ta - tb;
    });

    sorted.forEach((c) => {
      const dateObj = parseSafeDate(c.createdAt) || new Date(c.createdAt);
      const d = dateObj.toLocaleDateString('en-US', {
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
      if (c.location?.ward) wards.add(c.location.ward);
    });
    return Array.from(wards);
  }, [complaints]);

  // Filtered complaints for Complaint Management Table
  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = (c.id || '').toLowerCase().includes(q);
        const matchesDesc = (c.description || '').toLowerCase().includes(q);
        const matchesAddr = (c.location?.address || '').toLowerCase().includes(q);
        const matchesCategory = (c.category || '').toLowerCase().includes(q);
        if (!matchesId && !matchesDesc && !matchesAddr && !matchesCategory) {
          return false;
        }
      }

      // Status
      if (statusFilter !== 'all' && (c.status || '').toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }

      // Priority
      if (priorityFilter !== 'all' && (c.priority || '').toLowerCase() !== priorityFilter.toLowerCase()) {
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
      if (wardFilter !== 'all' && c.location?.ward !== wardFilter) {
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

  const handleApproveRouting = async (
    id: string,
    payload: {
      action: 'approve' | 'reject' | 'request_clarification';
      primaryDepartment?: { departmentName: string; description?: string };
      supportingDepartments?: Array<{ departmentName: string; reason?: string }>;
      priority?: string;
      adminNotes?: string;
      rejectionReason?: string;
    }
  ) => {
    try {
      await approveComplaintApi(id, payload);
      await refreshComplaints();
    } catch (err) {
      console.error('Failed to approve complaint routing:', err);
    }
    setSelectedComplaintForAssign(null);
  };

  const handleEscalateSubmit = (id: string, reason: string) => {
    adminEscalateComplaint(id, reason);
  };

  const handleCloseComplaint = async (complaintId: string) => {
    if (!window.confirm(`Perform official municipal closure for ticket ${complaintId}?`)) return;
    try {
      await closeComplaintApi(complaintId);
      await refreshComplaints();
      alert(`Complaint ${complaintId} has been officially closed.`);
    } catch (err: any) {
      alert(err.message || 'Cannot close complaint: Department tasks may still be pending.');
    }
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

            {/* 7. Knowledge & SOPs (M8) */}
            <button
              type="button"
              onClick={() => setActiveTab('knowledge')}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl transition cursor-pointer ${
                activeTab === 'knowledge'
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Knowledge / SOPs</span>
            </button>
          </nav>
        </div>

        {/* Authenticated Admin Session & Sign Out */}
        <div className="p-3 border-t border-slate-800/80 space-y-2">
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-800/60 border border-slate-700/60 text-white">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400 flex-shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-100 truncate">
                {user?.name || 'Administrator'}
              </p>
              <p className="text-[10px] text-slate-400 truncate capitalize">
                {user?.designation || 'Central Admin'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 rounded-xl text-xs font-bold transition border border-rose-500/20 cursor-pointer"
            title="Sign Out of Central Admin Portal"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
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
              onClick={() => setIsStaffModalOpen(true)}
              className="px-3.5 py-2 bg-gradient-to-r from-slate-900 to-indigo-900 hover:from-slate-800 hover:to-indigo-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer"
              title="Provision Department Staff Account"
            >
              <UserPlus className="w-3.5 h-3.5 text-indigo-300" />
              <span>Provision Staff</span>
            </button>

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

            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-xl text-xs font-bold text-slate-800 border border-slate-200">
              <Shield className="w-3.5 h-3.5 text-sky-600" />
              <span>{user?.name || 'Central Admin'}</span>
            </div>
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
                          <td className="py-3 text-slate-600 max-w-[180px] truncate">{comp.location?.address || 'N/A'}</td>
                          <td className="py-3">
                            <PriorityBadge priority={comp.priority} size="sm" />
                          </td>
                          <td className="py-3 text-slate-700 font-medium">{comp.department}</td>
                          <td className="py-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                              {comp.status}
                            </span>
                          </td>
                          <td className="py-3 text-right space-x-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenChatModal(comp)}
                              className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl transition cursor-pointer text-xs border border-indigo-200 inline-flex items-center gap-1"
                              title="Department Oversight Chat"
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Chat</span>
                            </button>
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
                            <span className="truncate block">{comp.location?.address || 'N/A'}</span>
                            <span className="text-[10px] text-slate-400 font-semibold">
                              {comp.location?.ward || 'Ward 102'}
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
                            {comp.status === 'Resolved' && (
                              <button
                                type="button"
                                onClick={() => handleCloseComplaint(comp.id)}
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer text-xs inline-flex items-center gap-1"
                                title="Finalize official municipal closure"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Close Ticket</span>
                              </button>
                            )}
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
                              onClick={() => handleOpenChatModal(comp)}
                              className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl transition cursor-pointer text-xs border border-indigo-200 inline-flex items-center gap-1"
                              title="Open Department Oversight Chat"
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Chat</span>
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
          {/* TAB 4: HOTSPOT MAP & RECURRING ISSUES (M11)          */}
          {/* ==================================================== */}
          {activeTab === 'hotspot-map' && (
            <div className="space-y-6">
              {/* Hotspots Control & Scan Bar */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-rose-100 text-rose-700 rounded-lg">
                      <Flame className="w-5 h-5" />
                    </span>
                    <h2 className="text-lg font-black text-slate-900 tracking-tight">
                      Module 11 – Recurring Issue and Hotspot Detection
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500">
                    Density-based spatial clustering (DBSCAN) and temporal trend analysis for preventive municipal action.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Observation Window Selector */}
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
                    <span className="text-slate-400 font-semibold">Window:</span>
                    <select
                      value={hotspotObservationWindow}
                      onChange={(e) => setHotspotObservationWindow(Number(e.target.value))}
                      className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer"
                    >
                      <option value={7}>7 Days</option>
                      <option value={30}>30 Days (Default)</option>
                      <option value={90}>90 Days</option>
                    </select>
                  </div>

                  {/* Status Filter */}
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
                    <span className="text-slate-400 font-semibold">Status:</span>
                    <select
                      value={hotspotStatusFilter}
                      onChange={(e) => setHotspotStatusFilter(e.target.value)}
                      className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer"
                    >
                      <option value="all">All Statuses</option>
                      <option value="DETECTED">Detected</option>
                      <option value="UNDER_REVIEW">Under Review</option>
                      <option value="ACTION_PLANNED">Action Planned</option>
                      <option value="MONITORING">Monitoring</option>
                      <option value="RESOLVED">Resolved</option>
                      <option value="REOPENED">Reopened</option>
                    </select>
                  </div>

                  {/* Category Filter */}
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
                    <span className="text-slate-400 font-semibold">Category:</span>
                    <select
                      value={hotspotCategoryFilter}
                      onChange={(e) => setHotspotCategoryFilter(e.target.value)}
                      className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer"
                    >
                      <option value="all">All Categories</option>
                      <option value="Pothole">Pothole</option>
                      <option value="Water Supply">Water Supply</option>
                      <option value="Drainage">Drainage</option>
                      <option value="Streetlight">Streetlight</option>
                      <option value="Garbage">Garbage</option>
                      <option value="Traffic">Traffic</option>
                    </select>
                  </div>

                  {/* Trigger DBSCAN Municipality Scan Button */}
                  <button
                    type="button"
                    disabled={isScanningHotspots}
                    onClick={handleTriggerScan}
                    className="px-4 py-2 bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-700 hover:to-indigo-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isScanningHotspots ? 'animate-spin' : ''}`} />
                    <span>{isScanningHotspots ? 'Running DBSCAN Scan...' : 'Scan Municipality Hotspots'}</span>
                  </button>
                </div>
              </div>

              {/* Hotspot KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider">Total Hotspots</span>
                    <Flame className="w-4 h-4 text-slate-600" />
                  </div>
                  <div className="text-2xl font-black text-slate-900">
                    {hotspotMetrics?.totalHotspots ?? serverHotspots.length}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-rose-200 bg-rose-50/20 shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-rose-600">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider">Active Hotspots</span>
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                  </div>
                  <div className="text-2xl font-black text-rose-800">
                    {hotspotMetrics?.activeHotspots ?? serverHotspots.filter((h) => h.status !== 'RESOLVED').length}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-amber-600">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider">Under Review</span>
                    <Clock className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="text-2xl font-black text-amber-800">
                    {hotspotMetrics?.underReviewHotspots ?? serverHotspots.filter((h) => h.status === 'UNDER_REVIEW').length}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-indigo-200 bg-indigo-50/20 shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-indigo-600">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider">Increasing Trend</span>
                    <TrendingUp className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="text-2xl font-black text-indigo-800">
                    {hotspotMetrics?.increasingHotspots ?? serverHotspots.filter((h) => h.temporalTrend?.classification === 'INCREASING').length}
                  </div>
                </div>
              </div>

              {/* Scan Result Feedback Banner */}
              {hotspotScanResult && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3 text-xs text-emerald-900">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      DBSCAN Scan complete: Scanned <strong>{hotspotScanResult.scanned}</strong> complaints across municipality. Detected <strong>{hotspotScanResult.clustersFound}</strong> clusters; updated/created <strong>{hotspotScanResult.hotspotsCreatedOrUpdated}</strong> persistent hotspot records.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHotspotScanResult(null)}
                    className="text-emerald-700 hover:text-emerald-900 font-bold"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Hotspot Map with Server Hotspots and Live Complaints */}
              <HotspotMap
                complaints={complaints}
                serverHotspots={serverHotspots}
                focusedComplaint={focusedMapComplaint}
                focusedHotspot={focusedHotspot}
                onSelectComplaint={(c) => setSelectedComplaintForAssign(c)}
                onSelectHotspot={handleOpenActionModal}
              />

              {/* Hotspots Detailed Registry Table */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base">
                      Persistent Recurring Issues & Hotspot Registry
                    </h3>
                    <p className="text-xs text-slate-500">
                      Administrative record of verified spatial clusters with preventive municipal action plans.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-xl self-start sm:self-auto">
                    {serverHotspots.length} Hotspot(s) Listed
                  </span>
                </div>

                {hotspotsLoading ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-rose-500" />
                    <span>Loading municipal hotspots...</span>
                  </div>
                ) : serverHotspots.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs space-y-2">
                    <Flame className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="font-bold text-slate-600">No Hotspots Match the Current Filters</p>
                    <p>Click "Scan Municipality Hotspots" above to run DBSCAN clustering on recent complaints.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-bold text-[10px] uppercase">
                          <th className="pb-3">Hotspot ID</th>
                          <th className="pb-3">Category</th>
                          <th className="pb-3">Ward & Radius</th>
                          <th className="pb-3">Complaints</th>
                          <th className="pb-3">Temporal Trend</th>
                          <th className="pb-3">Lifecycle Status</th>
                          <th className="pb-3">Preventive Action Plan</th>
                          <th className="pb-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {serverHotspots.map((h) => {
                          const trend = h.temporalTrend?.classification;
                          return (
                            <tr key={h._id} className="hover:bg-slate-50/60 transition">
                              <td className="py-3 font-bold text-slate-900">
                                <span>{h.hotspotId || `HOT-${h._id.slice(-6).toUpperCase()}`}</span>
                              </td>
                              <td className="py-3 font-semibold text-slate-800">
                                <div className="flex items-center gap-1.5">
                                  <CategoryIcon category={h.category as any} className="w-4 h-4" />
                                  <span>{h.category}</span>
                                </div>
                                {h.subcategory && (
                                  <span className="text-[10px] text-slate-400 font-normal block">
                                    {h.subcategory}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 text-slate-600 max-w-[160px]">
                                <span className="truncate block font-semibold">
                                  {h.location?.ward || 'Municipal Ward'}
                                </span>
                                <span className="text-[10px] text-slate-400 block truncate">
                                  Radius: {h.location?.radiusMeters ?? 100}m
                                </span>
                              </td>
                              <td className="py-3">
                                <span className="font-extrabold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-full">
                                  {h.complaintCount} in cluster
                                </span>
                              </td>
                              <td className="py-3">
                                <span
                                  className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                                    trend === 'INCREASING'
                                      ? 'bg-rose-100 text-rose-800'
                                      : trend === 'DECREASING'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : trend === 'STABLE'
                                      ? 'bg-slate-100 text-slate-700'
                                      : 'bg-amber-50 text-amber-700'
                                  }`}
                                >
                                  {trend === 'INCREASING' && <TrendingUp className="w-3 h-3 text-rose-600" />}
                                  {trend === 'DECREASING' && <TrendingDown className="w-3 h-3 text-emerald-600" />}
                                  {trend === 'STABLE' && <Minus className="w-3 h-3 text-slate-500" />}
                                  {trend || 'STABLE'}
                                  {h.temporalTrend?.percentageChange ? ` (${h.temporalTrend.percentageChange > 0 ? '+' : ''}${h.temporalTrend.percentageChange}%)` : ''}
                                </span>
                              </td>
                              <td className="py-3">
                                <span
                                  className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                                    h.status === 'RESOLVED'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : h.status === 'ACTION_PLANNED'
                                      ? 'bg-indigo-100 text-indigo-800'
                                      : h.status === 'UNDER_REVIEW'
                                      ? 'bg-amber-100 text-amber-800'
                                      : h.status === 'MONITORING'
                                      ? 'bg-sky-100 text-sky-800'
                                      : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {h.status}
                                </span>
                              </td>
                              <td className="py-3 max-w-[200px]">
                                {h.preventiveActionPlan?.proposedAction ? (
                                  <div className="space-y-0.5">
                                    <p className="text-slate-800 font-semibold truncate text-[11px]">
                                      {h.preventiveActionPlan.proposedAction}
                                    </p>
                                    {h.preventiveActionPlan.responsibleDepartment && (
                                      <p className="text-[10px] text-slate-400">
                                        Dept: {h.preventiveActionPlan.responsibleDepartment}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 italic text-[11px]">No action plan set</span>
                                )}
                              </td>
                              <td className="py-3 text-right space-x-1.5 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFocusedHotspot(h);
                                    window.scrollTo({ top: 400, behavior: 'smooth' });
                                  }}
                                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer text-xs"
                                  title="View centroid on map"
                                >
                                  <MapIcon className="w-3.5 h-3.5 inline mr-1" />
                                  Map
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenActionModal(h)}
                                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer text-xs"
                                  title="Update status & action plan"
                                >
                                  <Wrench className="w-3.5 h-3.5 inline mr-1" />
                                  Manage Plan
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
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

          {/* ==================================================== */}
          {/* TAB 7: KNOWLEDGE & MUNICIPAL SOPS (M8)              */}
          {/* ==================================================== */}
          {activeTab === 'knowledge' && (
            <div className="space-y-6">
              {/* Header Card */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200/60 rounded-md">
                      Module 8 (RAG)
                    </span>
                    <h2 className="text-lg font-black text-slate-900 tracking-tight">
                      Standard Operating Procedures (SOPs) & Knowledge Base
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Manage official engineering manuals, SLA guidelines, and procedural documentation for RAG grounding.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleReindexKnowledge}
                  disabled={isReindexing}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition inline-flex items-center gap-1.5 shadow-sm shadow-indigo-600/20 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isReindexing ? 'animate-spin' : ''}`} />
                  <span>{isReindexing ? 'Re-indexing Chunks...' : 'Re-index All SOP Chunks'}</span>
                </button>
              </div>

              {reindexMessage && (
                <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 text-xs font-semibold text-indigo-900 flex items-center justify-between">
                  <span>{reindexMessage}</span>
                  <button onClick={() => setReindexMessage(null)} className="text-indigo-500 hover:text-indigo-800">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Filters */}
              <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={knowledgeSearch}
                    onChange={(e) => setKnowledgeSearch(e.target.value)}
                    placeholder="Search documents by title, keyword, or manual code..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>

                <select
                  value={knowledgeDeptFilter}
                  onChange={(e) => setKnowledgeDeptFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none"
                >
                  <option value="all">All Departments</option>
                  {CORE_DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {/* Document Registry Table */}
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-sm text-slate-900">
                    Registered Knowledge Documents ({knowledgeDocs.length})
                  </h3>
                </div>

                {knowledgeLoading ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                    Loading official knowledge documents...
                  </div>
                ) : knowledgeDocs.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    No knowledge documents found matching the filter criteria.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-slate-400 uppercase text-[10px] font-bold border-b border-slate-100">
                          <th className="pb-3">Doc Code & Title</th>
                          <th className="pb-3">Department & Category</th>
                          <th className="pb-3">Type & Version</th>
                          <th className="pb-3">Status</th>
                          <th className="pb-3">Chunks</th>
                          <th className="pb-3">Source Citation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {knowledgeDocs.map((doc: any) => (
                          <tr key={doc._id} className="hover:bg-slate-50/80 transition">
                            <td className="py-3.5 pr-3">
                              <span className="font-mono text-[10px] text-slate-400 block font-bold">
                                {doc.code || 'SOP-DOC'}
                              </span>
                              <span className="font-bold text-slate-900 block">{doc.title}</span>
                              {doc.description && (
                                <span className="text-[11px] text-slate-500 line-clamp-1">
                                  {doc.description}
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 pr-3">
                              <span className="font-semibold text-slate-800 block">{doc.department}</span>
                              <span className="text-[10px] text-slate-400">
                                {doc.applicableCategories?.join(', ') || 'All categories'}
                              </span>
                            </td>
                            <td className="py-3.5 pr-3">
                              <span className="font-bold uppercase text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                                {doc.documentType || 'SOP'}
                              </span>
                              <span className="text-[10px] text-slate-400 block mt-0.5">
                                v{doc.version || '1.0'}
                              </span>
                            </td>
                            <td className="py-3.5 pr-3">
                              <div className="flex flex-col gap-1">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block w-fit ${
                                    doc.approvalStatus === 'approved'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                                  }`}
                                >
                                  {doc.approvalStatus === 'approved' ? '✓ Approved' : 'Draft'}
                                </span>
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.2 rounded w-fit ${
                                    doc.active
                                      ? 'bg-sky-50 text-sky-700'
                                      : 'bg-slate-100 text-slate-500'
                                  }`}
                                >
                                  {doc.active ? 'Active' : 'Inactive'}
                                </span>
                              </div>
                            </td>
                            <td className="py-3.5 pr-3 font-mono font-bold text-slate-700">
                              {doc.chunkCount || doc.chunks?.length || 3} chunks
                            </td>
                            <td className="py-3.5 text-slate-500 text-[11px] max-w-[200px] truncate">
                              {doc.source || 'Municipal Engineering Manual'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
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
          onApproveRouting={handleApproveRouting}
        />
      )}

      {/* Official Citizen-Department Oversight Chat Modal */}
      {isChatModalOpen && selectedComplaintForChat && (
        <AdminOfficialChatModal
          isOpen={isChatModalOpen}
          complaint={selectedComplaintForChat}
          onClose={() => {
            setIsChatModalOpen(false);
            setSelectedComplaintForChat(null);
          }}
        />
      )}

      {/* Staff Provisioning Modal */}
      <StaffProvisionModal
        isOpen={isStaffModalOpen}
        onClose={() => setIsStaffModalOpen(false)}
      />

      {/* Hotspot Preventive Action & Status Transition Modal */}
      {selectedHotspotForAction && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600 block">
                  Municipal Action Plan
                </span>
                <h3 className="text-base font-extrabold text-slate-900">
                  Manage Hotspot: {selectedHotspotForAction.hotspotId || 'M11 Hotspot'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHotspotForAction(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">
                    {selectedHotspotForAction.category} • {selectedHotspotForAction.location?.ward || 'Ward'}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500">
                    {selectedHotspotForAction.complaintCount} Complaints in Cluster
                  </span>
                </div>
                <p className="text-slate-500 text-[11px] truncate">
                  {selectedHotspotForAction.location?.address || 'N/A'}
                </p>
              </div>

              {/* Status Selector */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">Lifecycle Status</label>
                <select
                  value={actionModalStatus}
                  onChange={(e) => setActionModalStatus(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="DETECTED">DETECTED – Newly flagged cluster</option>
                  <option value="UNDER_REVIEW">UNDER_REVIEW – Engineering review in progress</option>
                  <option value="ACTION_PLANNED">ACTION_PLANNED – Preventive municipal work drafted</option>
                  <option value="MONITORING">MONITORING – Preventive action ongoing / post-repair monitoring</option>
                  <option value="RESOLVED">RESOLVED – Underlying civic issue fully addressed</option>
                  <option value="REOPENED">REOPENED – Recurrence observed after resolution</option>
                </select>
              </div>

              {/* Proposed Preventive Action */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">Proposed Preventive Action</label>
                <textarea
                  value={actionModalProposedPlan}
                  onChange={(e) => setActionModalProposedPlan(e.target.value)}
                  rows={3}
                  placeholder="e.g. Resurface 400m road stretch with bituminous concrete; replace faulty stormwater drainage valve..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {/* Responsible Department & Budget */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 block">Responsible Department</label>
                  <select
                    value={actionModalDept}
                    onChange={(e) => setActionModalDept(e.target.value)}
                    className="w-full p-2 rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="">Select Department...</option>
                    {CORE_DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 block">Estimated Budget (₹)</label>
                  <input
                    type="number"
                    value={actionModalBudget}
                    onChange={(e) => setActionModalBudget(e.target.value)}
                    placeholder="e.g. 50000"
                    className="w-full p-2 rounded-xl border border-slate-200 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              {/* Administrative Audit Note */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">Administrative Note (Audit Trail)</label>
                <input
                  type="text"
                  value={actionModalNotes}
                  onChange={(e) => setActionModalNotes(e.target.value)}
                  placeholder="Reason for status change or update notes..."
                  className="w-full p-2 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedHotspotForAction(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingAction}
                onClick={handleSaveHotspotAction}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-extrabold rounded-xl shadow-md transition text-xs flex items-center gap-1.5 cursor-pointer"
              >
                {isSubmittingAction ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Save Action Plan & Status</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
