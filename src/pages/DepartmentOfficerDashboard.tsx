import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useComplaints } from '../context/ComplaintContext';
import type { Complaint, ComplaintStatus } from '../types';
import { PriorityBadge } from '../components/common/PriorityBadge';
import { CategoryIcon } from '../components/common/CategoryIcon';
import { ComplaintDetailModal, ALL_DEPARTMENTS } from '../components/admin/ComplaintDetailModal';
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
  Home,
  UserCheck,
  AlertTriangle,
} from 'lucide-react';

export const DepartmentOfficerDashboard: React.FC = () => {
  const { complaints, officerUpdateComplaint, refreshComplaints, isLoading } = useComplaints();

  // Selected Department for Officer (defaults to Road Maintenance or First)
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [modalInitialStatus, setModalInitialStatus] = useState<ComplaintStatus | null>(null);

  // Officer metrics
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

  // Filtered list for Officer Work Queue
  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      // Department
      if (selectedDept !== 'all' && c.department !== selectedDept) return false;

      // Status
      if (statusFilter !== 'all' && c.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }

      // Priority
      if (priorityFilter !== 'all' && c.priority.toLowerCase() !== priorityFilter.toLowerCase()) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = c.id.toLowerCase().includes(q);
        const matchesDesc = c.description.toLowerCase().includes(q);
        const matchesAddr = c.location.address.toLowerCase().includes(q);
        const matchesCategory = c.category.toLowerCase().includes(q);
        if (!matchesId && !matchesDesc && !matchesAddr && !matchesCategory) return false;
      }

      return true;
    });
  }, [complaints, selectedDept, statusFilter, priorityFilter, searchQuery]);

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
                  Field<span className="text-amber-400">Officer</span>
                </span>
                <span className="text-[10px] text-slate-400 font-medium block">
                  Department Operations Portal
                </span>
              </div>
            </div>
          </div>

          {/* Department Selection Filter */}
          <div className="p-4 space-y-2">
            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block px-1">
              Active Field Department
            </label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400/40"
            >
              <option value="all">All Assigned Departments</option>
              {ALL_DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Workflow Steps Indicator */}
          <div className="p-3.5 mx-3 bg-slate-800/60 rounded-2xl border border-slate-800 space-y-2">
            <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider block">
              Workflow
            </span>
            <div className="space-y-1 text-[11px] text-slate-300">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-[9px]">1</span>
                <span>Receive</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center text-[9px]">2</span>
                <span>Inspect</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center text-[9px]">3</span>
                <span>Remediate</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[9px]">4</span>
                <span>Resolve</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Footer / Switchers */}
        <div className="p-3 border-t border-slate-800/80 space-y-1.5">
          <Link
            to="/admin"
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-sky-300 hover:text-white rounded-xl text-xs font-bold transition"
          >
            <Shield className="w-3.5 h-3.5 text-sky-400" />
            <span>Admin Portal</span>
          </Link>

          <Link
            to="/"
            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-slate-800/40 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-medium transition"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Citizen Portal</span>
          </Link>
        </div>
      </aside>

      {/* Main Officer Workspace */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        {/* Top Header */}
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold text-[10px] rounded-md uppercase tracking-wider">
                Field Operations
              </span>
              <span className="text-xs text-slate-400 font-semibold">• Zone 8</span>
            </div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight mt-0.5">
              Officer Work Queue
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => refreshComplaints()}
              disabled={isLoading}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh Queue</span>
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-bold">
              <UserCheck className="w-4 h-4 text-amber-600" />
              <span>Supervisor Selvam (Ward 102)</span>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <div className="p-6 space-y-6 flex-1">
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

          {/* High Priority Emergency Alert if any */}
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

          {/* Officer Task Table & Filter Bar */}
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
                {/* Search */}
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

                {/* Status Filter */}
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

                {/* Priority Filter */}
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

            {/* Table */}
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
                            <span className="truncate">{comp.location.address}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-bold block pl-4">
                            {comp.location.ward || 'Ward 102'}
                          </span>
                        </td>
                        <td className="py-3.5">
                          <PriorityBadge priority={comp.priority} size="sm" />
                        </td>
                        <td className="py-3.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              comp.status === 'Resolved'
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
                              Submit Resolution Proof
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
        </div>
      </main>

      {/* Field Inspection & Resolution Modal */}
      {selectedComplaint && (
        <ComplaintDetailModal
          complaint={selectedComplaint}
          onClose={() => {
            setSelectedComplaint(null);
            setModalInitialStatus(null);
          }}
          onUpdateStatus={handleOfficerSave}
          onUpdateDepartment={() => {}}
          initialStatus={modalInitialStatus}
        />
      )}
    </div>
  );
};
