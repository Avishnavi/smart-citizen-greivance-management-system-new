import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useComplaints } from '../context/ComplaintContext';
import { useAuth } from '../context/AuthContext';
import type { Complaint, ComplaintStatus, DepartmentTask } from '../types';
import {
  fetchAllDepartmentTasks,
  assignTaskApi,
  updateTaskStatusApi,
  submitTaskResolutionApi,
  verifyTaskResolutionApi,
  pauseTaskSlaApi,
  resumeTaskSlaApi,
} from '../services/complaintService';
import { PriorityBadge } from '../components/common/PriorityBadge';
import { CategoryIcon } from '../components/common/CategoryIcon';
import { ComplaintDetailModal, ALL_DEPARTMENTS, RESOLUTION_PHOTO_PRESETS } from '../components/admin/ComplaintDetailModal';
import {
  Wrench,
  FileCheck2,
  Clock,
  CheckCircle2,
  RefreshCw,
  Search,
  Camera,
  MapPin,
  Shield,
  UserCheck,
  AlertTriangle,
  Sparkles,
  Check,
  Send,
  X,
  FileText,
  BadgeCheck,
  BookOpen,
  Pause,
  Play,
  LogOut,
  MessageSquare,
} from 'lucide-react';
import { DepartmentOfficerChatModal } from '../components/chat/DepartmentOfficerChatModal';
import { fetchTaskKnowledge } from '../services/knowledgeService';
import { KnowledgeGuidanceCard } from '../components/common/KnowledgeGuidanceCard';
import type { KnowledgeGuidance } from '../types';

export const DepartmentOfficerDashboard: React.FC = () => {
  const { complaints, officerUpdateComplaint, refreshComplaints, isLoading: complaintsLoading } = useComplaints();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const isSupervisor = user?.role === 'department_supervisor';
  const isEmployee = user?.role === 'department_employee';

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'tasks' | 'complaints'>('tasks');

  // Tasks state
  const [tasks, setTasks] = useState<DepartmentTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>('all');
  const [taskTypeFilter, setTaskTypeFilter] = useState<string>('all');
  const [taskSearch, setTaskSearch] = useState('');

  // Selected Department for Officer (defaults to user's dept or 'all')
  const [selectedDept, setSelectedDept] = useState<string>(user?.departmentName || 'all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [modalInitialStatus, setModalInitialStatus] = useState<ComplaintStatus | null>(null);

  // Modals for Task Workflow
  const [assignModalTask, setAssignModalTask] = useState<DepartmentTask | null>(null);
  const [assignEmployeeName, setAssignEmployeeName] = useState('K. Ramesh');
  const [isAssigning, setIsAssigning] = useState(false);

  const [resolutionModalTask, setResolutionModalTask] = useState<DepartmentTask | null>(null);
  const [resNotes, setResNotes] = useState('');
  const [resProofUrl, setResProofUrl] = useState('');
  const [isSubmittingRes, setIsSubmittingRes] = useState(false);
  const [verificationFeedback, setVerificationFeedback] = useState<any | null>(null);

  // Supervisor Resolution Review Modal State (M12)
  const [supervisorReviewModalTask, setSupervisorReviewModalTask] = useState<DepartmentTask | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'request_rework' | 'reject'>('approve');
  const [reviewComments, setReviewComments] = useState('');
  const [reworkNotes, setReworkNotes] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Official Department Chat Modal State (Phase 5)
  const [chatModalTask, setChatModalTask] = useState<DepartmentTask | null>(null);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);

  const handleOpenChatModal = (task: DepartmentTask) => {
    setChatModalTask(task);
    setIsChatModalOpen(true);
  };

  const handleOpenSupervisorReviewModal = (task: DepartmentTask) => {
    setSupervisorReviewModalTask(task);
    setReviewAction('approve');
    setReviewComments('');
    setReworkNotes('');
  };

  const handleSupervisorReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supervisorReviewModalTask || !reviewComments.trim()) {
      alert('Supervisor review comment/reason is mandatory.');
      return;
    }
    try {
      setIsSubmittingReview(true);
      await verifyTaskResolutionApi(supervisorReviewModalTask.taskId, {
        action: reviewAction,
        comments: reviewComments.trim(),
        reworkRequirements: reworkNotes.trim() ? [reworkNotes.trim()] : [],
      });
      setSupervisorReviewModalTask(null);
      await loadDepartmentTasks();
      await refreshComplaints();
    } catch (err: any) {
      console.error('Supervisor review error:', err);
      alert(err.message || 'Failed to submit review.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Knowledge Support Modal / Guidance State
  const [knowledgeModalTask, setKnowledgeModalTask] = useState<DepartmentTask | null>(null);
  const [taskGuidance, setTaskGuidance] = useState<KnowledgeGuidance | null>(null);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);

  const handleOpenKnowledge = async (task: DepartmentTask) => {
    setKnowledgeModalTask(task);
    setKnowledgeLoading(true);
    try {
      const guidance = await fetchTaskKnowledge(task.taskId);
      setTaskGuidance(guidance);
    } catch (err) {
      console.warn('Could not load knowledge for task:', err);
      setTaskGuidance(null);
    } finally {
      setKnowledgeLoading(false);
    }
  };

  const handleOpenResolutionModal = async (task: DepartmentTask) => {
    setResolutionModalTask(task);
    setResNotes('');
    setResProofUrl('');
    setVerificationFeedback(null);
    setKnowledgeLoading(true);
    try {
      const guidance = await fetchTaskKnowledge(task.taskId);
      setTaskGuidance(guidance);
    } catch (err) {
      console.warn('Could not load knowledge for task resolution:', err);
      setTaskGuidance(null);
    } finally {
      setKnowledgeLoading(false);
    }
  };

  // Fetch tasks from backend
  const loadDepartmentTasks = async () => {
    setTasksLoading(true);
    try {
      const fetched = await fetchAllDepartmentTasks();
      setTasks(fetched);
    } catch (err) {
      console.warn('Could not load department tasks:', err);
    } finally {
      setTasksLoading(false);
    }
  };

  useEffect(() => {
    loadDepartmentTasks();
  }, [user]);

  // Task metrics
  const taskMetrics = useMemo(() => {
    const total = tasks.length;
    const pending = tasks.filter((t) => t.status === 'PENDING_ASSIGNMENT' || t.status === 'ASSIGNED').length;
    const inProgress = tasks.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'ACCEPTED').length;
    const verified = tasks.filter((t) => t.status === 'VERIFIED' || t.status === 'COMPLETED').length;
    const requiresWork = tasks.filter((t) => t.status === 'REQUIRES_ADDITIONAL_WORK' || t.status === 'AWAITING_REVIEW').length;
    const onTrack = tasks.filter((t) => t.slaStatus === 'ON_TRACK').length;
    const atRisk = tasks.filter((t) => t.slaStatus === 'AT_RISK').length;
    const overdue = tasks.filter((t) => t.slaStatus === 'OVERDUE' || t.isBreached).length;
    const highDelayRisk = tasks.filter((t) => t.delayRisk?.riskLevel === 'HIGH').length;
    return { total, pending, inProgress, verified, requiresWork, onTrack, atRisk, overdue, highDelayRisk };
  }, [tasks]);

  const handleTogglePauseSla = async (task: DepartmentTask) => {
    try {
      if (task.isPaused) {
        await resumeTaskSlaApi(task.taskId);
      } else {
        const reason = window.prompt('Enter reason for pausing SLA countdown:', 'Awaiting vendor materials or site access');
        if (!reason) return;
        await pauseTaskSlaApi(task.taskId, reason);
      }
      await loadDepartmentTasks();
    } catch (err: any) {
      alert(err.message || 'Failed to update SLA pause state');
    }
  };

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (taskStatusFilter !== 'all' && t.status !== taskStatusFilter) return false;
      if (taskTypeFilter !== 'all' && t.taskType !== taskTypeFilter) return false;
      if (taskSearch.trim()) {
        const q = taskSearch.toLowerCase();
        const mId = t.taskId.toLowerCase().includes(q);
        const mCmp = t.complaintId.toLowerCase().includes(q);
        const mTitle = t.title.toLowerCase().includes(q);
        const mEmp = (t.assignedEmployeeName || '').toLowerCase().includes(q);
        if (!mId && !mCmp && !mTitle && !mEmp) return false;
      }
      return true;
    });
  }, [tasks, taskStatusFilter, taskTypeFilter, taskSearch]);

  // Officer metrics (Complaints)
  const officerMetrics = useMemo(() => {
    const deptComplaints = selectedDept === 'all'
      ? complaints
      : complaints.filter((c) => c.department === selectedDept);

    const total = deptComplaints.length;
    const pending = deptComplaints.filter((c) => c.status === 'Pending').length;
    const inProgress = deptComplaints.filter((c) => c.status === 'In Progress').length;
    const resolved = deptComplaints.filter((c) => c.status === 'Resolved').length;
    const highPriority = deptComplaints.filter((c) => c.priority === 'High' && c.status !== 'Resolved').length;

    return { total, pending, inProgress, resolved, highPriority };
  }, [complaints, selectedDept]);

  // Filtered list for Officer Work Queue (Complaints)
  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      if (selectedDept !== 'all' && c.department !== selectedDept) return false;
      if (statusFilter !== 'all' && c.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
      if (priorityFilter !== 'all' && c.priority.toLowerCase() !== priorityFilter.toLowerCase()) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = (c.id || '').toLowerCase().includes(q);
        const matchesDesc = (c.description || '').toLowerCase().includes(q);
        const matchesAddr = (c.location?.address || '').toLowerCase().includes(q);
        const matchesCategory = (c.category || '').toLowerCase().includes(q);
        if (!matchesId && !matchesDesc && !matchesAddr && !matchesCategory) return false;
      }
      return true;
    });
  }, [complaints, selectedDept, statusFilter, priorityFilter, searchQuery]);

  // Handle Supervisor Task Assignment
  const handleAssignTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignModalTask || !assignEmployeeName) return;
    setIsAssigning(true);
    try {
      await assignTaskApi(assignModalTask.taskId, {
        employeeName: assignEmployeeName,
      });
      await loadDepartmentTasks();
      setAssignModalTask(null);
    } catch (err) {
      console.error('Assign task failed:', err);
      alert('Failed to assign task. Check authorization.');
    } finally {
      setIsAssigning(false);
    }
  };

  // Handle Employee quick status update
  const handleUpdateStatus = async (taskId: string, newStatus: string, note?: string) => {
    try {
      await updateTaskStatusApi(taskId, { status: newStatus, note });
      await loadDepartmentTasks();
    } catch (err) {
      console.error('Status update failed:', err);
    }
  };

  // Handle Employee Resolution Submission
  const handleResolutionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolutionModalTask || resNotes.trim().length < 10) {
      alert('Please enter at least 10 characters describing the resolution work performed.');
      return;
    }
    setIsSubmittingRes(true);
    setVerificationFeedback(null);
    try {
      const res = await submitTaskResolutionApi(resolutionModalTask.taskId, {
        resolutionNotes: resNotes.trim(),
        evidenceUrls: resProofUrl ? [resProofUrl] : [],
      });
      setVerificationFeedback(res.data?.verification || res.verification);
      await loadDepartmentTasks();
      await refreshComplaints();
    } catch (err: any) {
      console.error('Resolution submission failed:', err);
      alert(err.message || 'Resolution submission failed.');
    } finally {
      setIsSubmittingRes(false);
    }
  };

  const handleOpenModal = (complaint: Complaint, initialStatus?: ComplaintStatus) => {
    setSelectedComplaint(complaint);
    setModalInitialStatus(initialStatus || null);
  };

  const handleOfficerSave = (
    id: string,
    status: ComplaintStatus,
    resolutionData?: {
      proofImageUrl?: string;
      resolutionNotes?: string;
      officerName?: string;
    }
  ) => {
    officerUpdateComplaint(id, {
      status,
      resolution: resolutionData
        ? {
          resolvedAt: new Date().toISOString(),
          resolutionNotes: resolutionData.resolutionNotes || 'Inspected and resolved by field team.',
          proofImageUrl: resolutionData.proofImageUrl,
          officerName: resolutionData.officerName || 'Field Supervisor',
        }
        : undefined,
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col md:flex-row animate-in fade-in duration-200">
      {/* Officer Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 text-white flex-shrink-0 flex flex-col justify-between border-r border-slate-800">
        <div>
          {/* Officer Branding */}
          <div className="p-6 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <span className="font-extrabold text-sm sm:text-base tracking-tight block">
                  Department<span className="text-amber-400">Portal</span>
                </span>
                <span className="text-[10px] text-slate-400 font-medium block">
                  {user?.departmentName || 'Municipal Operations'}
                </span>
              </div>
            </div>
          </div>

          {/* User Badge in Sidebar */}
          <div className="p-4 bg-slate-800/50 m-3 rounded-2xl border border-slate-700/60 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                {isSupervisor ? 'Supervisor' : isEmployee ? 'Field Employee' : 'Staff Officer'}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {user?.employeeId || 'ID-Active'}
              </span>
            </div>
            <p className="text-xs font-bold text-white truncate">{user?.name || 'Officer'}</p>
            <p className="text-[11px] text-slate-400 truncate">{user?.zone || 'Zone 8 (Anna Nagar)'}</p>
          </div>

          {/* View Mode Switcher */}
          <div className="px-3 pt-2 space-y-1">
            <button
              type="button"
              onClick={() => setActiveTab('tasks')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition ${activeTab === 'tasks'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800'
                }`}
            >
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-4 h-4" />
                <span>Department Tasks</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-900/30">
                {tasks.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('complaints')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition ${activeTab === 'complaints'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800'
                }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span>All Grievances</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-900/30">
                {complaints.length}
              </span>
            </button>
          </div>

          {/* Department Selection Filter for Grievances */}
          {activeTab === 'complaints' && (
            <div className="p-4 space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block px-1">
                Filter Department
              </label>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold rounded-xl px-3 py-2 focus:outline-none"
              >
                <option value="all">All Departments</option>
                {ALL_DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Task Workflow Legend */}
          <div className="p-3.5 mx-3 mt-4 bg-slate-800/60 rounded-2xl border border-slate-800 space-y-2">
            <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider block">
              Workflow Stages
            </span>
            <div className="space-y-1.5 text-[11px] text-slate-300">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-[10px]">1</span>
                <span>Assign to Staff</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center text-[10px]">2</span>
                <span>Accept & Work</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center text-[10px]">3</span>
                <span>Submit Proof</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[10px]">4</span>
                <span>Automated Verification</span>
              </div>
            </div>
          </div>
        </div>

        {/* Authenticated Officer Session & Sign Out */}
        <div className="p-3 border-t border-slate-800/80 space-y-2">
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-800/60 border border-slate-700/60 text-white">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 flex-shrink-0">
              <UserCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-100 truncate">
                {user?.name || 'Staff Officer'}
              </p>
              <p className="text-[10px] text-slate-400 truncate capitalize">
                {isSupervisor ? 'Department Supervisor' : isEmployee ? 'Field Unit' : 'Department Staff'}
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
            title="Sign Out of Department Portal"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        {/* Top Header */}
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold text-[10px] rounded-md uppercase tracking-wider">
                {isSupervisor ? 'Supervisor Command' : isEmployee ? 'Field Unit' : 'Department Workspace'}
              </span>
              <span className="text-xs text-slate-400 font-semibold">• {user?.departmentName || 'Municipal Ops'}</span>
            </div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight mt-0.5">
              {activeTab === 'tasks' ? 'Department Tasks Queue' : 'Grievance Work Orders'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                loadDepartmentTasks();
                refreshComplaints();
              }}
              disabled={tasksLoading || complaintsLoading}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${tasksLoading || complaintsLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh Data</span>
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-bold">
              <UserCheck className="w-4 h-4 text-amber-600" />
              <span>{user?.name || 'Staff Officer'}</span>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <div className="p-6 space-y-6 flex-1">
          {activeTab === 'tasks' ? (
            /* ======================================================== */
            /* 1. DEPARTMENT TASKS VIEW (PHASE 2 WORKFLOW)              */
            /* ======================================================== */
            <>
              {/* Task KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1.5">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Department Tasks</span>
                    <FileCheck2 className="w-4 h-4 text-slate-600" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-slate-900">
                    {taskMetrics.total}
                  </div>
                  <span className="text-[11px] text-slate-500 block">Total assigned tasks</span>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-amber-200 bg-amber-50/20 shadow-xs space-y-1.5">
                  <div className="flex items-center justify-between text-amber-600">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Pending Assignment</span>
                    <Clock className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-amber-700">
                    {taskMetrics.pending}
                  </div>
                  <span className="text-[11px] text-amber-700 font-medium block">Needs staff assignment</span>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-indigo-200 bg-indigo-50/20 shadow-xs space-y-1.5">
                  <div className="flex items-center justify-between text-indigo-600">
                    <span className="text-[11px] font-bold uppercase tracking-wider">In Progress</span>
                    <RefreshCw className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-indigo-700">
                    {taskMetrics.inProgress}
                  </div>
                  <span className="text-[11px] text-indigo-700 font-medium block">Crew actively working</span>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-emerald-200 bg-emerald-50/20 shadow-xs space-y-1.5">
                  <div className="flex items-center justify-between text-emerald-600">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Verified Completed</span>
                    <BadgeCheck className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-emerald-700">
                    {taskMetrics.verified}
                  </div>
                  <span className="text-[11px] text-emerald-700 font-bold block">Resolution verified</span>
                </div>
              </div>

              {/* SLA & Delay Risk Quick Summary (M9 & M10) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900 text-white p-4 rounded-2xl shadow-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">On Track SLA</span>
                    <span className="text-base font-black text-emerald-400">{taskMetrics.onTrack}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">At Risk (&gt;75% SLA)</span>
                    <span className="text-base font-black text-amber-400">{taskMetrics.atRisk}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">SLA Overdue</span>
                    <span className="text-base font-black text-rose-400">{taskMetrics.overdue}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-orange-400"></div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">High Delay Risk (M10)</span>
                    <span className="text-base font-black text-orange-300">{taskMetrics.highDelayRisk}</span>
                  </div>
                </div>
              </div>

              {/* Tasks Table */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <h2 className="font-extrabold text-slate-900 text-sm sm:text-base">
                      {isSupervisor ? 'Department Staff Work Allocations' : 'My Assigned Field Tasks'}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {isSupervisor
                        ? 'Allocate tasks to field employees, track SLA milestones, and review submitted proof'
                        : 'Review assigned tasks, accept work order, record progress, and upload completion proof'}
                    </p>
                  </div>

                  {/* Filters */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={taskSearch}
                        onChange={(e) => setTaskSearch(e.target.value)}
                        placeholder="Search task or ID..."
                        className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 w-44"
                      />
                    </div>

                    <select
                      value={taskStatusFilter}
                      onChange={(e) => setTaskStatusFilter(e.target.value)}
                      className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-semibold focus:outline-none"
                    >
                      <option value="all">All Statuses</option>
                      <option value="PENDING_ASSIGNMENT">Pending Assignment</option>
                      <option value="ASSIGNED">Assigned</option>
                      <option value="ACCEPTED">Accepted</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="VERIFIED">Verified</option>
                      <option value="REQUIRES_ADDITIONAL_WORK">Needs Rework</option>
                    </select>

                    <select
                      value={taskTypeFilter}
                      onChange={(e) => setTaskTypeFilter(e.target.value)}
                      className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-semibold focus:outline-none"
                    >
                      <option value="all">All Roles</option>
                      <option value="primary">Primary Tasks</option>
                      <option value="supporting">Supporting Tasks</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-slate-400 uppercase text-[10px] font-bold border-b border-slate-100">
                        <th className="pb-3">Task ID</th>
                        <th className="pb-3">Parent Grievance</th>
                        <th className="pb-3">Role / Dept</th>
                        <th className="pb-3">Task Title & Details</th>
                        <th className="pb-3">Assigned Staff</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3">SLA Status</th>
                        <th className="pb-3">Delay Risk (M10)</th>
                        <th className="pb-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredTasks.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-12 text-center text-slate-400">
                            No department tasks found matching filters.
                          </td>
                        </tr>
                      ) : (
                        filteredTasks.map((task) => (
                          <tr key={task.taskId} className="hover:bg-slate-50/80 transition">
                            <td className="py-3.5 font-bold font-mono text-slate-900">
                              {task.taskId}
                            </td>
                            <td className="py-3.5 font-mono text-slate-600 font-semibold">
                              {task.complaintId}
                            </td>
                            <td className="py-3.5">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${task.taskType === 'primary'
                                    ? 'bg-sky-100 text-sky-800'
                                    : 'bg-indigo-100 text-indigo-800'
                                  }`}
                              >
                                {task.taskType}
                              </span>
                              <span className="block text-[11px] text-slate-500 font-medium">
                                {task.departmentName}
                              </span>
                            </td>
                            <td className="py-3.5 max-w-xs">
                              <span className="font-bold text-slate-900 block truncate">
                                {task.title}
                              </span>
                              <span className="text-[11px] text-slate-500 block truncate">
                                {task.description}
                              </span>
                              {task.status === 'REQUIRES_ADDITIONAL_WORK' && task.resolution?.supervisorReview?.comments && (
                                <div className="mt-1 text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-1.5 leading-tight">
                                  <strong>Supervisor Feedback:</strong> {task.resolution.supervisorReview.comments}
                                </div>
                              )}
                            </td>
                            <td className="py-3.5">
                              {task.assignedEmployeeName ? (
                                <div className="flex items-center gap-1.5 text-slate-800 font-semibold">
                                  <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>{task.assignedEmployeeName}</span>
                                </div>
                              ) : (
                                <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 font-semibold">
                                  Unassigned
                                </span>
                              )}
                            </td>
                            <td className="py-3.5">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${task.status === 'VERIFIED' || task.status === 'COMPLETED'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : task.status === 'IN_PROGRESS' || task.status === 'ACCEPTED'
                                      ? 'bg-sky-100 text-sky-800'
                                      : task.status === 'REQUIRES_ADDITIONAL_WORK'
                                        ? 'bg-rose-100 text-rose-800'
                                        : task.status === 'AWAITING_REVIEW'
                                          ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                          : 'bg-amber-100 text-amber-800'
                                  }`}
                              >
                                {task.status.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="py-3.5">
                              <div className="space-y-0.5">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${task.slaStatus === 'OVERDUE'
                                      ? 'bg-rose-100 text-rose-800'
                                      : task.slaStatus === 'AT_RISK'
                                        ? 'bg-amber-100 text-amber-800'
                                        : task.slaStatus === 'COMPLETED_WITHIN_SLA'
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : task.slaStatus === 'COMPLETED_AFTER_SLA'
                                            ? 'bg-slate-200 text-slate-800'
                                            : 'bg-teal-100 text-teal-800'
                                    }`}
                                >
                                  {task.isPaused ? 'PAUSED' : task.slaStatus || 'ON_TRACK'}
                                </span>
                                <span className="block text-[10px] text-slate-500 font-medium">
                                  {task.remainingHours !== undefined
                                    ? task.remainingHours > 0
                                      ? `${task.remainingHours}h remaining`
                                      : `Overdue by ${Math.abs(task.remainingHours)}h`
                                    : `${task.slaHours || 72}h SLA`}
                                </span>
                              </div>
                            </td>
                            <td className="py-3.5">
                              {task.delayRisk ? (
                                <div
                                  className="space-y-0.5 cursor-help"
                                  title={task.delayRisk.contributingFactors?.join(' • ') || 'Nominal execution'}
                                >
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold ${task.delayRisk.riskLevel === 'HIGH'
                                        ? 'bg-rose-100 text-rose-900 border border-rose-300'
                                        : task.delayRisk.riskLevel === 'MODERATE'
                                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                      }`}
                                  >
                                    {task.delayRisk.riskLevel} ({task.delayRisk.riskScore}/100)
                                  </span>
                                  <span className="block text-[9px] text-slate-400 truncate max-w-[120px]">
                                    {task.delayRisk.contributingFactors?.[0] || 'Feature baseline'}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400">Low</span>
                              )}
                            </td>
                            <td className="py-3.5 text-right space-x-1.5">
                              {/* Supervisor Pause/Resume SLA Action */}
                              {isSupervisor && !['VERIFIED', 'COMPLETED', 'REJECTED'].includes(task.status) && (
                                <button
                                  type="button"
                                  onClick={() => handleTogglePauseSla(task)}
                                  title={task.isPaused ? 'Resume SLA timer' : 'Pause SLA timer'}
                                  className={`p-1.5 rounded-xl text-xs font-semibold transition inline-flex items-center justify-center ${task.isPaused
                                      ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                      : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                                    }`}
                                >
                                  {task.isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                                </button>
                              )}
                              {/* Supervisor Assign Action */}
                              {isSupervisor && task.status === 'PENDING_ASSIGNMENT' && (
                                <button
                                  type="button"
                                  onClick={() => setAssignModalTask(task)}
                                  className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs transition shadow-xs"
                                >
                                  Assign Staff
                                </button>
                              )}

                              {/* Employee Actions */}
                              {task.status === 'ASSIGNED' && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateStatus(task.taskId, 'ACCEPTED', 'Task accepted by field technician.')}
                                  className="px-2.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs transition"
                                >
                                  Accept Task
                                </button>
                              )}

                              {task.status === 'ACCEPTED' && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateStatus(task.taskId, 'IN_PROGRESS', 'Work started on-site.')}
                                  className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition"
                                >
                                  Start Work
                                </button>
                              )}

                              {/* Knowledge / SOP Guidance Action */}
                              <button
                                type="button"
                                onClick={() => handleOpenKnowledge(task)}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition inline-flex items-center gap-1 shadow-xs"
                                title="View Municipal SOP Guidance"
                              >
                                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                                <span>SOP</span>
                              </button>

                              {/* Official Department Chat Action */}
                              <button
                                type="button"
                                onClick={() => handleOpenChatModal(task)}
                                className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold rounded-xl text-xs transition inline-flex items-center gap-1 shadow-xs border border-sky-200"
                                title="Open Official Department Conversation"
                              >
                                <MessageSquare className="w-3.5 h-3.5 text-sky-600" />
                                <span>Chat</span>
                              </button>

                              {/* Supervisor Human Verification Action */}
                              {isSupervisor && task.status !== 'VERIFIED' && (task.status === 'AWAITING_REVIEW' || task.resolution?.resolutionNotes) && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenSupervisorReviewModal(task)}
                                  className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition inline-flex items-center gap-1 shadow-xs"
                                  title="Perform Human Supervisor Verification Review"
                                >
                                  <Shield className="w-3.5 h-3.5" />
                                  <span>{task.status === 'AWAITING_REVIEW' ? 'Review & Verify' : 'Verify'}</span>
                                </button>
                              )}

                              {['IN_PROGRESS', 'ACCEPTED', 'REQUIRES_ADDITIONAL_WORK'].includes(task.status) && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenResolutionModal(task)}
                                  className={`px-2.5 py-1.5 text-white font-bold rounded-xl text-xs transition shadow-xs ${task.status === 'REQUIRES_ADDITIONAL_WORK'
                                      ? 'bg-amber-600 hover:bg-amber-700 animate-pulse'
                                      : 'bg-emerald-600 hover:bg-emerald-700'
                                    }`}
                                  title={task.status === 'REQUIRES_ADDITIONAL_WORK' ? 'Resubmit after rework' : 'Submit Proof'}
                                >
                                  {task.status === 'REQUIRES_ADDITIONAL_WORK' ? 'Resubmit Proof' : 'Submit Proof'}
                                </button>
                              )}

                              {['VERIFIED', 'COMPLETED'].includes(task.status) && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                                  <Check className="w-3 h-3" />
                                  Verified
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            /* ======================================================== */
            /* 2. ALL GRIEVANCES VIEW (LEGACY COMPLAINT OVERVIEW)       */
            /* ======================================================== */
            <>
              {/* 4 Officer KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1.5">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Assigned Total</span>
                    <FileCheck2 className="w-4 h-4 text-slate-600" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-slate-900">
                    {officerMetrics.total}
                  </div>
                  <span className="text-[11px] text-slate-500 block">Assigned work orders</span>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-amber-200 bg-amber-50/20 shadow-xs space-y-1.5">
                  <div className="flex items-center justify-between text-amber-600">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Pending Inspection</span>
                    <Clock className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-amber-700">
                    {officerMetrics.pending}
                  </div>
                  <span className="text-[11px] text-amber-700 font-medium block">Awaiting site visit</span>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-indigo-200 bg-indigo-50/20 shadow-xs space-y-1.5">
                  <div className="flex items-center justify-between text-indigo-600">
                    <span className="text-[11px] font-bold uppercase tracking-wider">In Progress</span>
                    <RefreshCw className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-indigo-700">
                    {officerMetrics.inProgress}
                  </div>
                  <span className="text-[11px] text-indigo-700 font-medium block">Field crew on site</span>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-emerald-200 bg-emerald-50/20 shadow-xs space-y-1.5">
                  <div className="flex items-center justify-between text-emerald-600">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Resolved & Proofed</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-emerald-700">
                    {officerMetrics.resolved}
                  </div>
                  <span className="text-[11px] text-emerald-700 font-bold block">Verified completed</span>
                </div>
              </div>

              {/* High Priority Emergency Alert */}
              {officerMetrics.highPriority > 0 && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between gap-3 text-rose-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-600 text-white rounded-xl">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="font-extrabold text-xs sm:text-sm block">
                        {officerMetrics.highPriority} High-Priority Emergency Hazard(s) Pending
                      </span>
                      <span className="text-xs text-rose-600">
                        Immediate on-site inspection and safety cordon required under SLA protocols.
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPriorityFilter('High')}
                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
                  >
                    Filter High Priority
                  </button>
                </div>
              )}

              {/* Complaints Table */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <h2 className="font-extrabold text-slate-900 text-sm sm:text-base">
                      Assigned Field Work Orders
                    </h2>
                    <p className="text-xs text-slate-500">
                      Update progress, record field inspection remarks, and upload resolution proof photos
                    </p>
                  </div>

                  {/* Filters */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search ticket or street..."
                        className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 w-44"
                      />
                    </div>

                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-semibold focus:outline-none"
                    >
                      <option value="all">All Statuses</option>
                      <option value="Pending">Pending Inspection</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Resolved">Resolved</option>
                    </select>

                    <select
                      value={priorityFilter}
                      onChange={(e) => setPriorityFilter(e.target.value)}
                      className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-semibold focus:outline-none"
                    >
                      <option value="all">All Priorities</option>
                      <option value="High">High Priority</option>
                      <option value="Medium">Medium Priority</option>
                      <option value="Low">Low Priority</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-slate-400 uppercase text-[10px] font-bold border-b border-slate-100">
                        <th className="pb-3">Ticket ID</th>
                        <th className="pb-3">Category</th>
                        <th className="pb-3">Location & Ward</th>
                        <th className="pb-3">Priority</th>
                        <th className="pb-3">Current Status</th>
                        <th className="pb-3">Field Proof</th>
                        <th className="pb-3 text-right">Field Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredComplaints.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-10 text-center text-slate-400">
                            No assigned work orders matching the selected filters.
                          </td>
                        </tr>
                      ) : (
                        filteredComplaints.map((comp) => (
                          <tr key={comp.id} className="hover:bg-slate-50/80 transition">
                            <td className="py-3.5 font-bold font-mono text-slate-900">
                              {comp.id}
                            </td>
                            <td className="py-3.5">
                              <div className="flex items-center gap-2">
                                <CategoryIcon category={comp.category} className="w-4 h-4" />
                                <span className="font-semibold text-slate-800">{comp.category}</span>
                              </div>
                            </td>
                            <td className="py-3.5 text-slate-600 max-w-[200px] truncate">
                              <div className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                <span className="truncate">{comp.location?.address || 'N/A'}</span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-bold block pl-4">
                                {comp.location?.ward || 'Ward 102'}
                              </span>
                            </td>
                            <td className="py-3.5">
                              <PriorityBadge priority={comp.priority} size="sm" />
                            </td>
                            <td className="py-3.5">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${comp.status === 'Resolved'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : comp.status === 'In Progress'
                                      ? 'bg-indigo-100 text-indigo-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                              >
                                {comp.status}
                              </span>
                            </td>
                            <td className="py-3.5">
                              {comp.resolution?.proofImageUrl ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                  <Camera className="w-3 h-3" />
                                  Proof Attached
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-medium">
                                  No proof yet
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 text-right space-x-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  const deptTask = tasks.find((t) => t.complaintId === comp.id);
                                  handleOpenChatModal(deptTask || {
                                    taskId: comp.id,
                                    complaintId: comp.id,
                                    departmentId: user?.departmentId || undefined,
                                    departmentName: user?.departmentName || comp.department || 'Department',
                                    title: comp.description,
                                    description: comp.description || '',
                                    status: comp.status,
                                    priority: comp.priority,
                                    taskType: 'primary',
                                  });
                                }}
                                className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold rounded-xl transition cursor-pointer text-xs border border-sky-200 inline-flex items-center gap-1"
                                title="Open Department Chat"
                              >
                                <MessageSquare className="w-3.5 h-3.5 text-sky-600" />
                                <span>Chat</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenModal(comp)}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer text-xs"
                              >
                                Inspect / Update
                              </button>
                              {comp.status !== 'Resolved' && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenModal(comp, 'Resolved')}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer text-xs"
                                >
                                  Submit Proof
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Supervisor Staff Assignment Modal */}
      {assignModalTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-5 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-400/30">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm">Assign Staff to Task</h3>
                  <span className="text-[11px] font-mono text-slate-300">{assignModalTask.taskId}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAssignModalTask(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAssignTaskSubmit} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Task Details</span>
                <p className="font-bold text-slate-900">{assignModalTask.title}</p>
                <p className="text-slate-600">{assignModalTask.description}</p>
                <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-500">
                  <span>Parent: <strong className="font-mono text-slate-700">{assignModalTask.complaintId}</strong></span>
                  <span>• Priority: <strong className="text-slate-700">{assignModalTask.priority}</strong></span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1.5">
                  Select Department Employee / Field Technician
                </label>
                <select
                  value={assignEmployeeName}
                  onChange={(e) => setAssignEmployeeName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                >
                  <option value="K. Ramesh">K. Ramesh (Field Crew Lead & Road Inspector)</option>
                  <option value="A. Rahman">A. Rahman (Asst Engineer)</option>
                  <option value="K. Suresh">K. Suresh (Field Tech)</option>
                  <option value="S. Ganesh">S. Ganesh (Lineman)</option>
                  <option value="V. Kumar">V. Kumar (Zonal Officer)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAssignModalTask(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAssigning}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-black rounded-xl shadow-xs transition"
                >
                  {isAssigning ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supervisor Resolution Human Verification Review Modal (M12) */}
      {supervisorReviewModalTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-400/30">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm">Supervisor Evidence Verification Review</h3>
                  <span className="text-[11px] font-mono text-slate-300">
                    {supervisorReviewModalTask.taskId} • {supervisorReviewModalTask.departmentName}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSupervisorReviewModalTask(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSupervisorReviewSubmit} className="p-6 space-y-4 text-xs">
              {/* Task Header Summary */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">{supervisorReviewModalTask.title}</span>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                    Assignee: {supervisorReviewModalTask.assignedEmployeeName || 'Field Employee'}
                  </span>
                </div>
                <p className="text-slate-600">{supervisorReviewModalTask.description}</p>
              </div>

              {/* Submitted Resolution Notes & Evidence */}
              <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Employee's Submitted Resolution Notes
                </span>
                <p className="text-slate-800 font-medium whitespace-pre-wrap bg-slate-50 p-3 rounded-xl border border-slate-100">
                  {supervisorReviewModalTask.resolution?.resolutionNotes || 'No notes entered.'}
                </p>

                {supervisorReviewModalTask.resolution?.evidenceUrls && supervisorReviewModalTask.resolution.evidenceUrls.length > 0 && (
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Submitted Photographic Evidence ({supervisorReviewModalTask.resolution.evidenceUrls.length})
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {supervisorReviewModalTask.resolution.evidenceUrls.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-xl overflow-hidden border border-slate-200 hover:border-indigo-400 transition group"
                        >
                          <img
                            src={url}
                            alt="Resolution Evidence"
                            className="h-28 w-full object-cover group-hover:scale-105 transition duration-200"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                          <span className="p-1 bg-slate-100 text-[10px] text-slate-600 truncate block">
                            Evidence Attachment #{i + 1}
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Automated Multi-Dimensional Assessment Breakdown */}
              {supervisorReviewModalTask.resolution?.automatedAssessment && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <span className="font-extrabold text-slate-900 text-xs">
                        Automated Verification Quality Rubric
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-base font-black text-indigo-700">
                        {supervisorReviewModalTask.resolution.automatedAssessment.overallScore}/100
                      </span>
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${supervisorReviewModalTask.resolution.automatedAssessment.recommendation === 'APPROVE_RECOMMENDED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : supervisorReviewModalTask.resolution.automatedAssessment.recommendation === 'REWORK_RECOMMENDED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                      >
                        {supervisorReviewModalTask.resolution.automatedAssessment.recommendation?.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Factor Scores Grid */}
                  {supervisorReviewModalTask.resolution.automatedAssessment.factorScores && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                      <div className="bg-white p-2 rounded-xl border border-slate-200">
                        <span className="text-slate-400 block text-[10px]">Description</span>
                        <span className="font-bold text-slate-800">
                          {supervisorReviewModalTask.resolution.automatedAssessment.factorScores.descriptionCompleteness?.score ?? 0}/25 pts
                        </span>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-slate-200">
                        <span className="text-slate-400 block text-[10px]">Task Relevance</span>
                        <span className="font-bold text-slate-800">
                          {supervisorReviewModalTask.resolution.automatedAssessment.factorScores.taskRelevance?.score ?? 0}/25 pts
                        </span>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-slate-200">
                        <span className="text-slate-400 block text-[10px]">Evidence</span>
                        <span className="font-bold text-slate-800">
                          {supervisorReviewModalTask.resolution.automatedAssessment.factorScores.evidenceAvailability?.score ?? 0}/20 pts
                        </span>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-slate-200">
                        <span className="text-slate-400 block text-[10px]">Checklist Match</span>
                        <span className="font-bold text-slate-800">
                          {supervisorReviewModalTask.resolution.automatedAssessment.factorScores.checklistCompliance?.score ?? 0}/15 pts
                        </span>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-slate-200">
                        <span className="text-slate-400 block text-[10px]">SOP Alignment</span>
                        <span className="font-bold text-slate-800">
                          {supervisorReviewModalTask.resolution.automatedAssessment.factorScores.sopAlignment?.score ?? 0}/15 pts
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Missing requirements or inconsistencies */}
                  {supervisorReviewModalTask.resolution.automatedAssessment.missingRequirements &&
                    supervisorReviewModalTask.resolution.automatedAssessment.missingRequirements.length > 0 && (
                      <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px] space-y-1">
                        <span className="font-bold block">Identified Missing Requirements:</span>
                        <ul className="list-disc pl-4 space-y-0.5">
                          {supervisorReviewModalTask.resolution.automatedAssessment.missingRequirements.map((m, i) => (
                            <li key={i}>{m}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>
              )}

              {/* Review Decision Selector */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">Supervisor Decision *</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setReviewAction('approve')}
                    className={`p-2.5 rounded-xl border font-bold text-center transition cursor-pointer ${reviewAction === 'approve'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-400 shadow-xs ring-2 ring-emerald-400/20'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                  >
                    Approve & Verify
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewAction('request_rework')}
                    className={`p-2.5 rounded-xl border font-bold text-center transition cursor-pointer ${reviewAction === 'request_rework'
                        ? 'bg-amber-50 text-amber-800 border-amber-400 shadow-xs ring-2 ring-amber-400/20'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                  >
                    Request Rework
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewAction('reject')}
                    className={`p-2.5 rounded-xl border font-bold text-center transition cursor-pointer ${reviewAction === 'reject'
                        ? 'bg-rose-50 text-rose-800 border-rose-400 shadow-xs ring-2 ring-rose-400/20'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                  >
                    Reject Submission
                  </button>
                </div>
              </div>

              {/* Mandatory Review Comments */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">
                  Supervisor Review Comments / Instructions *
                </label>
                <textarea
                  rows={3}
                  value={reviewComments}
                  onChange={(e) => setReviewComments(e.target.value)}
                  placeholder={
                    reviewAction === 'approve'
                      ? 'Verified on site: asphalt aggregate compaction flush with road surface, compliant with Road Maintenance SOP v2.4.'
                      : 'Specify reason for rework or additional evidence required from employee...'
                  }
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              {/* Specific Rework Requirements (when rework is chosen) */}
              {reviewAction === 'request_rework' && (
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 block">Rework Requirements for Field Staff</label>
                  <input
                    type="text"
                    value={reworkNotes}
                    onChange={(e) => setReworkNotes(e.target.value)}
                    placeholder="e.g. Resurface road section edges with vibrating plate compactor; upload close-up level photo."
                    className="w-full p-2 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              )}

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSupervisorReviewModalTask(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReview}
                  className={`px-5 py-2 text-white font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer ${reviewAction === 'approve'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : reviewAction === 'request_rework'
                        ? 'bg-amber-600 hover:bg-amber-700'
                        : 'bg-rose-600 hover:bg-rose-700'
                    }`}
                >
                  {isSubmittingReview ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {isSubmittingReview
                      ? 'Saving Review...'
                      : reviewAction === 'approve'
                        ? 'Approve & Mark Verified'
                        : reviewAction === 'request_rework'
                          ? 'Dispatch Rework Order'
                          : 'Confirm Rejection'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Employee Resolution Submission Modal */}
      {resolutionModalTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-5 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-400/30">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm">Submit Work Completion & Proof</h3>
                  <span className="text-[11px] font-mono text-slate-300">{resolutionModalTask.taskId}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResolutionModalTask(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResolutionSubmit} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <p className="font-bold text-slate-900">{resolutionModalTask.title}</p>
                <p className="text-slate-600">{resolutionModalTask.description}</p>
              </div>

              {/* Grounded Municipal SOP & Knowledge Support Guidance */}
              <KnowledgeGuidanceCard
                guidance={taskGuidance}
                isLoading={knowledgeLoading}
                onRefresh={() => handleOpenKnowledge(resolutionModalTask)}
                title="Grounded Municipal Resolution Standard"
              />

              {/* Automated Verification Feedback Alert */}
              {verificationFeedback && (
                <div
                  className={`p-3.5 rounded-2xl border space-y-1 ${verificationFeedback.verified
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : verificationFeedback.verificationStatus === 'insufficient_evidence'
                        ? 'bg-rose-50 border-rose-200 text-rose-900'
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}
                >
                  <div className="flex items-center gap-1.5 font-bold">
                    <Sparkles className="w-4 h-4" />
                    <span>
                      Automated Verification Outcome: {verificationFeedback.verificationStatus?.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed">{verificationFeedback.reason}</p>
                  <span className="text-[10px] font-mono block pt-0.5">
                    Score: {Math.round((verificationFeedback.verificationScore || 0) * 100)}%
                  </span>
                </div>
              )}

              {/* Resolution Notes Input */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Resolution Notes & Physical Actions Taken *
                </label>
                <textarea
                  rows={3}
                  value={resNotes}
                  onChange={(e) => setResNotes(e.target.value)}
                  placeholder="Describe in detail what was repaired, replaced, cleared, or cleaned on site..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  required
                />
              </div>

              {/* Photo Proof URL / Presets */}
              <div className="space-y-2">
                <label className="block font-bold text-slate-800">
                  Resolution Photo Proof (URL or Preset)
                </label>
                <input
                  type="url"
                  value={resProofUrl}
                  onChange={(e) => setResProofUrl(e.target.value)}
                  placeholder="https://... photo of resolved site"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none"
                />

                <span className="text-[10px] text-slate-400 font-semibold block">Or select standard preset:</span>
                <div className="grid grid-cols-2 gap-2">
                  {RESOLUTION_PHOTO_PRESETS.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setResProofUrl(p.url);
                        if (!resNotes) setResNotes(p.defaultNotes);
                      }}
                      className="p-2 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-200 border border-slate-200 rounded-xl text-left transition text-[11px]"
                    >
                      <span className="font-bold block">{p.icon} {p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setResolutionModalTask(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRes}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmittingRes ? 'Verifying...' : 'Submit for Verification'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supervisor Resolution Human Verification Review Modal (M12) */}
      {supervisorReviewModalTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-400/30">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm">Supervisor Evidence Verification Review</h3>
                  <span className="text-[11px] font-mono text-slate-300">
                    {supervisorReviewModalTask.taskId} • {supervisorReviewModalTask.departmentName}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSupervisorReviewModalTask(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSupervisorReviewSubmit} className="p-6 space-y-4 text-xs">
              {/* Task Header Summary */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">{supervisorReviewModalTask.title}</span>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                    Assignee: {supervisorReviewModalTask.assignedEmployeeName || 'Field Employee'}
                  </span>
                </div>
                <p className="text-slate-600">{supervisorReviewModalTask.description}</p>
              </div>

              {/* Submitted Resolution Notes & Evidence */}
              <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Employee's Submitted Resolution Notes
                </span>
                <p className="text-slate-800 font-medium whitespace-pre-wrap bg-slate-50 p-3 rounded-xl border border-slate-100">
                  {supervisorReviewModalTask.resolution?.resolutionNotes || 'No notes entered.'}
                </p>

                {supervisorReviewModalTask.resolution?.evidenceUrls && supervisorReviewModalTask.resolution.evidenceUrls.length > 0 && (
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Submitted Photographic Evidence ({supervisorReviewModalTask.resolution.evidenceUrls.length})
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {supervisorReviewModalTask.resolution.evidenceUrls.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-xl overflow-hidden border border-slate-200 hover:border-indigo-400 transition group"
                        >
                          <img
                            src={url}
                            alt="Resolution Evidence"
                            className="h-28 w-full object-cover group-hover:scale-105 transition duration-200"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                          <span className="p-1 bg-slate-100 text-[10px] text-slate-600 truncate block">
                            Evidence Attachment #{i + 1}
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Automated Multi-Dimensional Assessment Breakdown */}
              {supervisorReviewModalTask.resolution?.automatedAssessment && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <span className="font-extrabold text-slate-900 text-xs">
                        Automated Verification Quality Rubric
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-base font-black text-indigo-700">
                        {supervisorReviewModalTask.resolution.automatedAssessment.overallScore}/100
                      </span>
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${supervisorReviewModalTask.resolution.automatedAssessment.recommendation === 'APPROVE_RECOMMENDED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : supervisorReviewModalTask.resolution.automatedAssessment.recommendation === 'REWORK_RECOMMENDED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                      >
                        {supervisorReviewModalTask.resolution.automatedAssessment.recommendation?.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Factor Scores Grid */}
                  {supervisorReviewModalTask.resolution.automatedAssessment.factorScores && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                      <div className="bg-white p-2 rounded-xl border border-slate-200">
                        <span className="text-slate-400 block text-[10px]">Description</span>
                        <span className="font-bold text-slate-800">
                          {supervisorReviewModalTask.resolution.automatedAssessment.factorScores.descriptionCompleteness?.score ?? 0}/25 pts
                        </span>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-slate-200">
                        <span className="text-slate-400 block text-[10px]">Task Relevance</span>
                        <span className="font-bold text-slate-800">
                          {supervisorReviewModalTask.resolution.automatedAssessment.factorScores.taskRelevance?.score ?? 0}/25 pts
                        </span>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-slate-200">
                        <span className="text-slate-400 block text-[10px]">Evidence</span>
                        <span className="font-bold text-slate-800">
                          {supervisorReviewModalTask.resolution.automatedAssessment.factorScores.evidenceAvailability?.score ?? 0}/20 pts
                        </span>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-slate-200">
                        <span className="text-slate-400 block text-[10px]">Checklist Match</span>
                        <span className="font-bold text-slate-800">
                          {supervisorReviewModalTask.resolution.automatedAssessment.factorScores.checklistCompliance?.score ?? 0}/15 pts
                        </span>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-slate-200">
                        <span className="text-slate-400 block text-[10px]">SOP Alignment</span>
                        <span className="font-bold text-slate-800">
                          {supervisorReviewModalTask.resolution.automatedAssessment.factorScores.sopAlignment?.score ?? 0}/15 pts
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Missing requirements or inconsistencies */}
                  {supervisorReviewModalTask.resolution.automatedAssessment.missingRequirements &&
                    supervisorReviewModalTask.resolution.automatedAssessment.missingRequirements.length > 0 && (
                      <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px] space-y-1">
                        <span className="font-bold block">Identified Missing Requirements:</span>
                        <ul className="list-disc pl-4 space-y-0.5">
                          {supervisorReviewModalTask.resolution.automatedAssessment.missingRequirements.map((m, i) => (
                            <li key={i}>{m}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>
              )}

              {/* Review Decision Selector */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">Supervisor Decision *</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setReviewAction('approve')}
                    className={`p-2.5 rounded-xl border font-bold text-center transition cursor-pointer ${reviewAction === 'approve'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-400 shadow-xs ring-2 ring-emerald-400/20'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                  >
                    Approve & Verify
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewAction('request_rework')}
                    className={`p-2.5 rounded-xl border font-bold text-center transition cursor-pointer ${reviewAction === 'request_rework'
                        ? 'bg-amber-50 text-amber-800 border-amber-400 shadow-xs ring-2 ring-amber-400/20'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                  >
                    Request Rework
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewAction('reject')}
                    className={`p-2.5 rounded-xl border font-bold text-center transition cursor-pointer ${reviewAction === 'reject'
                        ? 'bg-rose-50 text-rose-800 border-rose-400 shadow-xs ring-2 ring-rose-400/20'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                  >
                    Reject Submission
                  </button>
                </div>
              </div>

              {/* Mandatory Review Comments */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">
                  Supervisor Review Comments / Instructions *
                </label>
                <textarea
                  rows={3}
                  value={reviewComments}
                  onChange={(e) => setReviewComments(e.target.value)}
                  placeholder={
                    reviewAction === 'approve'
                      ? 'Verified on site: asphalt aggregate compaction flush with road surface, compliant with Road Maintenance SOP v2.4.'
                      : 'Specify reason for rework or additional evidence required from employee...'
                  }
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              {/* Specific Rework Requirements (when rework is chosen) */}
              {reviewAction === 'request_rework' && (
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 block">Rework Requirements for Field Staff</label>
                  <input
                    type="text"
                    value={reworkNotes}
                    onChange={(e) => setReworkNotes(e.target.value)}
                    placeholder="e.g. Resurface road section edges with vibrating plate compactor; upload close-up level photo."
                    className="w-full p-2 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              )}

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSupervisorReviewModalTask(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReview}
                  className={`px-5 py-2 text-white font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer ${reviewAction === 'approve'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : reviewAction === 'request_rework'
                        ? 'bg-amber-600 hover:bg-amber-700'
                        : 'bg-rose-600 hover:bg-rose-700'
                    }`}
                >
                  {isSubmittingReview ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {isSubmittingReview
                      ? 'Saving Review...'
                      : reviewAction === 'approve'
                        ? 'Approve & Mark Verified'
                        : reviewAction === 'request_rework'
                          ? 'Dispatch Rework Order'
                          : 'Confirm Rejection'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Standalone Municipal SOP & Knowledge Modal */}
      {knowledgeModalTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-5 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-400/30">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm">Municipal SOP & Knowledge Guidance</h3>
                  <span className="text-[11px] font-mono text-slate-300">
                    {knowledgeModalTask.taskId} • {knowledgeModalTask.departmentName}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setKnowledgeModalTask(null);
                  setTaskGuidance(null);
                }}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                <span className="font-bold text-slate-900 block">{knowledgeModalTask.title}</span>
                <span className="text-slate-600 block pt-0.5">{knowledgeModalTask.description}</span>
              </div>
              <KnowledgeGuidanceCard
                guidance={taskGuidance}
                isLoading={knowledgeLoading}
                onRefresh={() => handleOpenKnowledge(knowledgeModalTask)}
                title={`SOP Guidance: ${knowledgeModalTask.departmentName}`}
              />
            </div>
          </div>
        </div>
      )}

      {/* Field Inspection & Resolution Modal (Legacy Grievance Detail) */}
      {selectedComplaint && (
        <ComplaintDetailModal
          complaint={selectedComplaint}
          onClose={() => {
            setSelectedComplaint(null);
            setModalInitialStatus(null);
          }}
          onUpdateStatus={handleOfficerSave}
          onUpdateDepartment={() => { }}
          initialStatus={modalInitialStatus}
        />
      )}

      {/* Official Department Chat Modal (Phase 5) */}
      {isChatModalOpen && chatModalTask && (
        <DepartmentOfficerChatModal
          isOpen={isChatModalOpen}
          task={chatModalTask}
          onClose={() => {
            setIsChatModalOpen(false);
            setChatModalTask(null);
          }}
        />
      )}
    </div>
  );
};
