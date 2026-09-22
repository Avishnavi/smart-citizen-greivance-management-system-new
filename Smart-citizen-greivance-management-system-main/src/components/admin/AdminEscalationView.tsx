import React, { useState, useMemo } from 'react';
import type { Complaint } from '../../types';
import { PriorityBadge } from '../common/PriorityBadge';
import { CategoryIcon } from '../common/CategoryIcon';
import {
  AlertTriangle,
  Clock,
  Send,
  RefreshCw,
  ShieldAlert,
  Flame,
  BellRing,
} from 'lucide-react';

interface AdminEscalationViewProps {
  complaints: Complaint[];
  onReassignComplaint: (complaint: Complaint) => void;
  onEscalateComplaint: (id: string, reason: string) => void;
  onSendNotice: (id: string, message: string) => void;
}

type EscalationSubTab = 'all-escalated' | 'overdue' | 'sla-approaching' | 'high-priority-stalled' | 'long-pending';

export const AdminEscalationView: React.FC<AdminEscalationViewProps> = ({
  complaints,
  onReassignComplaint,
  onEscalateComplaint,
  onSendNotice,
}) => {
  const [activeTab, setActiveTab] = useState<EscalationSubTab>('all-escalated');
  const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string>('URGENT: This grievance has exceeded SLA standard turnaround. Executive inspection required immediately.');
  const [escalateModalId, setEscalateModalId] = useState<string | null>(null);
  const [escalateReason, setEscalateReason] = useState<string>('SLA Turnaround exceeded standard municipal window.');

  // Categorize complaints for SLA analysis
  const categorized = useMemo(() => {
    const now = Date.now();

    // Escalated
    const escalatedList = complaints.filter(
      (c) => c.escalated || c.status === 'Rejected' || (c.priorityScore && c.priorityScore > 85 && c.status !== 'Resolved')
    );

    // Overdue (created > 2 days ago and not resolved, or high priority > 1 day)
    const overdueList = complaints.filter((c) => {
      if (c.status === 'Resolved') return false;
      const ageHours = (now - new Date(c.createdAt).getTime()) / (1000 * 60 * 60);
      return ageHours > 48 || (c.priority === 'High' && ageHours > 24);
    });

    // SLA Approaching (age between 12h and 36h)
    const slaApproachingList = complaints.filter((c) => {
      if (c.status === 'Resolved') return false;
      const ageHours = (now - new Date(c.createdAt).getTime()) / (1000 * 60 * 60);
      return ageHours >= 12 && ageHours <= 48;
    });

    // High Priority Stalled (High priority and still Pending)
    const highPriorityStalledList = complaints.filter(
      (c) => c.priority === 'High' && c.status === 'Pending'
    );

    // Long Pending (> 24 hours in Pending status)
    const longPendingList = complaints.filter((c) => {
      if (c.status !== 'Pending') return false;
      const ageHours = (now - new Date(c.createdAt).getTime()) / (1000 * 60 * 60);
      return ageHours >= 24;
    });

    return {
      escalatedList,
      overdueList,
      slaApproachingList,
      highPriorityStalledList,
      longPendingList,
    };
  }, [complaints]);

  // Current display list based on active tab
  const currentList = useMemo(() => {
    switch (activeTab) {
      case 'overdue':
        return categorized.overdueList;
      case 'sla-approaching':
        return categorized.slaApproachingList;
      case 'high-priority-stalled':
        return categorized.highPriorityStalledList;
      case 'long-pending':
        return categorized.longPendingList;
      case 'all-escalated':
      default:
        return categorized.escalatedList;
    }
  }, [activeTab, categorized]);

  const handleSendNoticeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNoticeId || !noticeMessage.trim()) return;
    onSendNotice(selectedNoticeId, noticeMessage.trim());
    setSelectedNoticeId(null);
  };

  const handleEscalateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!escalateModalId || !escalateReason.trim()) return;
    onEscalateComplaint(escalateModalId, escalateReason.trim());
    setEscalateModalId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 bg-gradient-to-r from-rose-950 via-slate-900 to-indigo-950 text-white rounded-3xl border border-rose-900/40 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-rose-500/20 text-rose-300 border border-rose-400/30 rounded-xl">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
            </span>
            <h2 className="text-xl font-black tracking-tight">
              SLA Escalation Center
            </h2>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 rounded-md text-[11px] font-semibold">SLA Breach Tracking</span>
            <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 rounded-md text-[11px] font-semibold">Priority Escalations</span>
            <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 rounded-md text-[11px] font-semibold">Direct Supervisor Notice</span>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto text-xs font-bold">
          <div className="px-4 py-2.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-center">
            <span className="text-rose-300 text-[10px] uppercase block">Active Escalations</span>
            <span className="text-rose-400 text-lg font-black">{categorized.escalatedList.length}</span>
          </div>
          <div className="px-4 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-center">
            <span className="text-amber-300 text-[10px] uppercase block">Overdue SLA</span>
            <span className="text-amber-400 text-lg font-black">{categorized.overdueList.length}</span>
          </div>
        </div>
      </div>

      {/* 4 SLA Categorical KPI Filter Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <button
          type="button"
          onClick={() => setActiveTab('all-escalated')}
          className={`p-4 rounded-3xl border text-left transition-all cursor-pointer ${
            activeTab === 'all-escalated'
              ? 'bg-rose-50 border-rose-300 shadow-sm ring-2 ring-rose-500/20'
              : 'bg-white border-slate-200 hover:border-rose-200'
          }`}
        >
          <div className="flex items-center justify-between text-rose-600 mb-1">
            <span className="text-[10px] font-extrabold uppercase">Escalated Tickets</span>
            <Flame className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-rose-900">{categorized.escalatedList.length}</div>
          <span className="text-[11px] text-slate-500">Executive attention flagged</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('overdue')}
          className={`p-4 rounded-3xl border text-left transition-all cursor-pointer ${
            activeTab === 'overdue'
              ? 'bg-amber-50 border-amber-300 shadow-sm ring-2 ring-amber-500/20'
              : 'bg-white border-slate-200 hover:border-amber-200'
          }`}
        >
          <div className="flex items-center justify-between text-amber-600 mb-1">
            <span className="text-[10px] font-extrabold uppercase">Overdue SLA</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-amber-900">{categorized.overdueList.length}</div>
          <span className="text-[11px] text-slate-500">Exceeded standard turnaround</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('high-priority-stalled')}
          className={`p-4 rounded-3xl border text-left transition-all cursor-pointer ${
            activeTab === 'high-priority-stalled'
              ? 'bg-red-50 border-red-300 shadow-sm ring-2 ring-red-500/20'
              : 'bg-white border-slate-200 hover:border-red-200'
          }`}
        >
          <div className="flex items-center justify-between text-red-600 mb-1">
            <span className="text-[10px] font-extrabold uppercase">High Priority Stalled</span>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-red-900">{categorized.highPriorityStalledList.length}</div>
          <span className="text-[11px] text-slate-500">Pending without field dispatch</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('long-pending')}
          className={`p-4 rounded-3xl border text-left transition-all cursor-pointer ${
            activeTab === 'long-pending'
              ? 'bg-sky-50 border-sky-300 shadow-sm ring-2 ring-sky-500/20'
              : 'bg-white border-slate-200 hover:border-sky-200'
          }`}
        >
          <div className="flex items-center justify-between text-sky-600 mb-1">
            <span className="text-[10px] font-extrabold uppercase">Long-Pending Queue</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-sky-900">{categorized.longPendingList.length}</div>
          <span className="text-[11px] text-slate-500">&gt;24h in unallocated queue</span>
        </button>
      </div>

      {/* Escalation Table */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
              {activeTab === 'all-escalated' && 'All Administratively Escalated Grievances'}
              {activeTab === 'overdue' && 'Overdue Complaints Breaching Municipal SLA'}
              {activeTab === 'high-priority-stalled' && 'High-Priority Emergency Complaints Pending Triage'}
              {activeTab === 'long-pending' && 'Long-Pending Complaints Requiring Reallocation'}
            </h3>
            <p className="text-xs text-slate-500">
              Showing {currentList.length} tickets requiring administrative intervention
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 uppercase text-[10px] font-bold border-b border-slate-100">
                <th className="pb-3">Ticket ID</th>
                <th className="pb-3">Category & Summary</th>
                <th className="pb-3">Assigned Department</th>
                <th className="pb-3">Priority</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Escalation / SLA Note</th>
                <th className="pb-3 text-right">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    No active tickets in this escalation queue. Excellent SLA compliance!
                  </td>
                </tr>
              ) : (
                currentList.map((comp) => (
                  <tr key={comp.id} className="hover:bg-slate-50 transition">
                    <td className="py-3.5 font-bold font-mono text-slate-900">
                      {comp.id}
                      {comp.escalated && (
                        <span className="block text-[9px] text-rose-600 font-extrabold uppercase">
                          Escalated
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 max-w-[220px]">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                        <CategoryIcon category={comp.category} className="w-3.5 h-3.5" />
                        <span>{comp.category}</span>
                      </div>
                      <p className="text-slate-500 text-[11px] truncate mt-0.5">
                        {comp.description}
                      </p>
                    </td>
                    <td className="py-3.5 text-slate-700">
                      <span className="font-semibold block">{comp.department}</span>
                      <span className="text-[10px] text-slate-400">
                        {comp.assignedOfficer || 'Field Team Assigned'}
                      </span>
                    </td>
                    <td className="py-3.5">
                      <PriorityBadge priority={comp.priority} size="sm" />
                    </td>
                    <td className="py-3.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                        {comp.status}
                      </span>
                    </td>
                    <td className="py-3.5 max-w-[180px] text-[11px] text-rose-700 font-medium">
                      {comp.escalationReason || (comp.priorityScore ? `Severity Score: ${comp.priorityScore}` : 'SLA Turnaround Flag')}
                    </td>
                    <td className="py-3.5 text-right space-x-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedNoticeId(comp.id)}
                        className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold rounded-xl transition cursor-pointer text-xs"
                        title="Send Direct Administrative Dispatch Notice"
                      >
                        <BellRing className="w-3.5 h-3.5 inline mr-1" />
                        Send Notice
                      </button>

                      <button
                        type="button"
                        onClick={() => onReassignComplaint(comp)}
                        className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl transition cursor-pointer text-xs"
                        title="Reassign to another department or officer"
                      >
                        <RefreshCw className="w-3.5 h-3.5 inline mr-1" />
                        Reassign
                      </button>

                      {!comp.escalated && (
                        <button
                          type="button"
                          onClick={() => setEscalateModalId(comp.id)}
                          className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer text-xs"
                          title="Escalate priority to High"
                        >
                          <Flame className="w-3.5 h-3.5 inline mr-1" />
                          Escalate
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

      {/* Send Administrative Notice Modal */}
      {selectedNoticeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-sky-100 text-sky-700 rounded-2xl">
                <BellRing className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  Dispatch Administrative Notice
                </h3>
                <p className="text-xs text-slate-500">Ticket: {selectedNoticeId}</p>
              </div>
            </div>

            <form onSubmit={handleSendNoticeSubmit} className="space-y-3 text-xs">
              <label className="block font-bold text-slate-700">Official Direct Directive</label>
              <textarea
                value={noticeMessage}
                onChange={(e) => setNoticeMessage(e.target.value)}
                rows={4}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedNoticeId(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Dispatch Notice</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Escalate Modal */}
      {escalateModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-rose-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-100 text-rose-700 rounded-2xl">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  Flag Administrative Escalation
                </h3>
                <p className="text-xs text-slate-500">Ticket: {escalateModalId}</p>
              </div>
            </div>

            <form onSubmit={handleEscalateSubmit} className="space-y-3 text-xs">
              <label className="block font-bold text-slate-700">Reason for Escalation</label>
              <textarea
                value={escalateReason}
                onChange={(e) => setEscalateReason(e.target.value)}
                rows={3}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEscalateModalId(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Confirm Escalation</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
