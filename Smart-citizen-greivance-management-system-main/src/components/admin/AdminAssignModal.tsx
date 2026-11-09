import React, { useState } from 'react';
import type { Complaint, Department } from '../../types';
import { PriorityBadge } from '../common/PriorityBadge';
import { CategoryIcon } from '../common/CategoryIcon';
import {
  X,
  Building2,
  UserCheck,
  FileText,
  CheckCircle2,
  Shield,
  MapPin,
  Sparkles,
  Plus,
  Trash2,
  HelpCircle,
  XCircle,
} from 'lucide-react';

export const CORE_DEPARTMENTS: Department[] = [
  'Road Maintenance Department',
  'Water & Sewerage Board',
  'Electricity & Lighting Department',
  'Solid Waste Management',
  'Traffic & Transport Department',
  'Public Health & Sanitation',
  'Town Planning & Enforcement',
  'Horticulture & Parks',
];

export const MUNICIPAL_OFFICERS: Record<string, string[]> = {
  'Road Maintenance Department': ['Er. S. Selvam (Ward 102)', 'Er. M. Ramesh (Ward 101)', 'R. Kanna (Superintendent)'],
  'Water & Sewerage Board': ['A. Rahman (Asst Engineer)', 'K. Suresh (Field Tech)'],
  'Electricity & Lighting Department': ['P. Nathan (Electrical Inspector)', 'S. Ganesh (Lineman)'],
  'Solid Waste Management': ['M. Lakshmi (Sanitary Inspector)', 'V. Kumar (Zonal Officer)'],
  'Traffic & Transport Department': ['Er. V. Murugan (Traffic Eng)', 'D. Joseph (Signals Lead)'],
  'Public Health & Sanitation': ['Dr. N. Meena (Health Officer)', 'S. Priya (Chief Sanitary Supv)'],
  'Town Planning & Enforcement': ['Er. K. Sivakumar (Enforcement Lead)', 'A. Devi (Town Planner)'],
  'Horticulture & Parks': ['R. Govind (Park Superintendent)', 'M. Anitha (Horticulturist)'],
};

interface SupportingDeptItem {
  departmentName: Department;
  reason: string;
}

interface AdminAssignModalProps {
  complaint: Complaint | null;
  onClose: () => void;
  onAssign: (id: string, department: Department, officerName?: string, notes?: string) => void;
  onEscalate?: (id: string, reason: string) => void;
  onApproveRouting?: (
    id: string,
    payload: {
      action: 'approve' | 'reject' | 'request_clarification';
      primaryDepartment?: { departmentName: string; description?: string };
      supportingDepartments?: Array<{ departmentName: string; reason?: string }>;
      priority?: string;
      adminNotes?: string;
      rejectionReason?: string;
    }
  ) => void;
}

export const AdminAssignModal: React.FC<AdminAssignModalProps> = ({
  complaint,
  onClose,
  onAssign,
  onEscalate,
  onApproveRouting,
}) => {
  const [activeMode, setActiveMode] = useState<'orchestration' | 'direct'>('orchestration');

  // Primary Department
  const [primaryDept, setPrimaryDept] = useState<Department>(
    (complaint?.department as Department) || 'Road Maintenance Department'
  );
  const [priority, setPriority] = useState<string>(complaint?.priority || 'Medium');

  // Supporting Departments (Multi-department tasks)
  const [supportingDepts, setSupportingDepts] = useState<SupportingDeptItem[]>([]);
  const [newSupportingDept, setNewSupportingDept] = useState<Department>('Water & Sewerage Board');
  const [newSupportingReason, setNewSupportingReason] = useState<string>('');

  // Direct Officer Assignment State
  const [selectedOfficer, setSelectedOfficer] = useState<string>(
    complaint?.assignedOfficer || (complaint ? MUNICIPAL_OFFICERS[complaint.department]?.[0] : '') || 'Er. S. Selvam'
  );
  const [adminNotes, setAdminNotes] = useState<string>(complaint?.adminNotes || '');
  const [isEscalating, setIsEscalating] = useState(false);
  const [escalateReason, setEscalateReason] = useState('Critical safety hazard or SLA delay requires urgent municipal intervention.');

  // Clarification / Rejection Action states
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'request_clarification'>('approve');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!complaint) return null;

  const handleDeptChange = (dept: Department) => {
    setPrimaryDept(dept);
    const officers = MUNICIPAL_OFFICERS[dept] || ['Zonal Officer / Supervisor'];
    setSelectedOfficer(officers[0]);
  };

  const handleAddSupportingDept = () => {
    if (!newSupportingDept) return;
    if (newSupportingDept === primaryDept) {
      alert('Supporting department cannot be the same as the Primary Department.');
      return;
    }
    if (supportingDepts.some((s) => s.departmentName === newSupportingDept)) {
      alert('This supporting department is already added.');
      return;
    }
    setSupportingDepts((prev) => [
      ...prev,
      {
        departmentName: newSupportingDept,
        reason: newSupportingReason.trim() || `Assist with ${complaint.category} remediation.`,
      },
    ]);
    setNewSupportingReason('');
  };

  const handleRemoveSupportingDept = (index: number) => {
    setSupportingDepts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (onApproveRouting && activeMode === 'orchestration') {
        await onApproveRouting(complaint.id, {
          action: actionType,
          primaryDepartment: {
            departmentName: primaryDept,
            description: adminNotes || `Primary task for ${complaint.category}`,
          },
          supportingDepartments: supportingDepts.map((s) => ({
            departmentName: s.departmentName,
            reason: s.reason,
          })),
          priority,
          adminNotes,
          rejectionReason,
        });
      } else {
        // Fallback to legacy onAssign
        onAssign(complaint.id, primaryDept, selectedOfficer, adminNotes);
      }

      if (isEscalating && onEscalate) {
        onEscalate(complaint.id, escalateReason);
      }
      onClose();
    } catch (err) {
      console.error('Assignment error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableOfficers = MUNICIPAL_OFFICERS[primaryDept] || ['Department Duty Officer', 'Field Supervisor'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 text-white flex items-center justify-between border-b border-slate-800 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-400/30 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-md border border-sky-400/20">
                  Municipal Command Review
                </span>
                <span className="text-xs font-mono font-bold text-slate-300">
                  {complaint.id}
                </span>
              </div>
              <h2 className="text-lg font-black tracking-tight mt-0.5">
                Central Admin Review & Task Orchestration
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Complaint Summary Card with AI Recommendation */}
        <div className="p-6 space-y-5">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CategoryIcon category={complaint.category} className="w-4 h-4" />
                <span className="font-bold text-slate-900">{complaint.category}</span>
                <span className="text-slate-400 font-mono text-[11px]">({complaint.status})</span>
              </div>
              <PriorityBadge priority={complaint.priority} size="sm" />
            </div>
            <p className="text-slate-700 leading-relaxed font-normal">
              "{complaint.description}"
            </p>
            <div className="flex items-center gap-1.5 text-slate-500 text-[11px] pt-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{complaint.location.address}</span>
            </div>

            {/* AI Recommendation Banner */}
            <div className="mt-2 p-3 bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200/80 rounded-xl flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5 text-[11px]">
                <p className="font-bold text-sky-950">
                  AI Department Recommendation: <span className="text-indigo-700 font-extrabold">{complaint.department}</span>
                </p>
                <p className="text-slate-600">
                  Confidence: <span className="font-semibold text-slate-800">92%</span> • SLA Target: <span className="font-semibold text-slate-800">48h</span> • Recommended as Primary Department.
                </p>
              </div>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <button
              type="button"
              onClick={() => setActiveMode('orchestration')}
              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition ${
                activeMode === 'orchestration'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Multi-Department Dispatch (Phase 2)
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('direct')}
              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition ${
                activeMode === 'direct'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Direct Officer Assignment
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {activeMode === 'orchestration' ? (
              <>
                {/* Action Type Selection */}
                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-800">Review Decision</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setActionType('approve')}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                        actionType === 'approve'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Approve & Dispatch</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActionType('request_clarification')}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                        actionType === 'request_clarification'
                          ? 'bg-amber-50 border-amber-500 text-amber-800 ring-2 ring-amber-500/20'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                      <span>Request Info</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActionType('reject')}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                        actionType === 'reject'
                          ? 'bg-rose-50 border-rose-500 text-rose-800 ring-2 ring-rose-500/20'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <XCircle className="w-3.5 h-3.5 text-rose-600" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>

                {actionType === 'reject' && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl space-y-2">
                    <label className="block font-bold text-rose-900">
                      Rejection Reason (Communicated to Citizen)
                    </label>
                    <textarea
                      rows={2}
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Explain why this grievance cannot be entertained (e.g. Duplicate complaint, outside municipal jurisdiction, private property dispute)..."
                      className="w-full p-2.5 bg-white border border-rose-200 rounded-xl text-rose-900 focus:outline-none focus:ring-2 focus:ring-rose-400"
                      required
                    />
                  </div>
                )}

                {actionType === 'request_clarification' && (
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
                    <label className="block font-bold text-amber-900">
                      Clarification Note for Citizen
                    </label>
                    <textarea
                      rows={2}
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Specify exact missing information (e.g. Door number, nearby landmark, updated photo of leak)..."
                      className="w-full p-2.5 bg-white border border-amber-200 rounded-xl text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      required
                    />
                  </div>
                )}

                {actionType === 'approve' && (
                  <>
                    {/* Primary Department & Priority */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                          <Building2 className="w-4 h-4 text-sky-600" />
                          <span>Primary Department</span>
                        </label>
                        <select
                          value={primaryDept}
                          onChange={(e) => handleDeptChange(e.target.value as Department)}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                        >
                          {CORE_DEPARTMENTS.map((dept) => (
                            <option key={dept} value={dept}>
                              {dept}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-800 mb-1">Priority Override</label>
                        <select
                          value={priority}
                          onChange={(e) => setPriority(e.target.value)}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                        >
                          <option value="Critical">Critical (12h SLA)</option>
                          <option value="High">High (24h SLA)</option>
                          <option value="Medium">Medium (48h SLA)</option>
                          <option value="Low">Low (72h SLA)</option>
                        </select>
                      </div>
                    </div>

                    {/* Supporting Departments List */}
                    <div className="space-y-2 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 text-xs">
                          Supporting Departments ({supportingDepts.length})
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Spawns separate tasks under {complaint.id}
                        </span>
                      </div>

                      {supportingDepts.length > 0 ? (
                        <div className="space-y-1.5">
                          {supportingDepts.map((sd, idx) => (
                            <div
                              key={idx}
                              className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs gap-2"
                            >
                              <div>
                                <span className="font-bold text-indigo-700 block">{sd.departmentName}</span>
                                <span className="text-slate-600 text-[11px]">{sd.reason}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveSupportingDept(idx)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition"
                                title="Remove supporting department"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400 italic">
                          No supporting departments added. Only 1 primary task will be dispatched.
                        </p>
                      )}

                      {/* Add Supporting Department form */}
                      <div className="pt-2 flex flex-col sm:flex-row gap-2 border-t border-slate-200">
                        <select
                          value={newSupportingDept}
                          onChange={(e) => setNewSupportingDept(e.target.value as Department)}
                          className="bg-white border border-slate-200 text-xs rounded-xl p-2 font-medium"
                        >
                          {CORE_DEPARTMENTS.filter((d) => d !== primaryDept).map((dept) => (
                            <option key={dept} value={dept}>
                              {dept}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={newSupportingReason}
                          onChange={(e) => setNewSupportingReason(e.target.value)}
                          placeholder="Role / instruction for supporting dept..."
                          className="flex-1 bg-white border border-slate-200 text-xs rounded-xl px-2.5 py-1.5"
                        />
                        <button
                          type="button"
                          onClick={handleAddSupportingDept}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl flex items-center justify-center gap-1 transition text-xs shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Dept</span>
                        </button>
                      </div>
                    </div>

                    {/* Admin Directives */}
                    <div>
                      <label className="block font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-slate-500" />
                        <span>Central Admin Directives</span>
                      </label>
                      <textarea
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        rows={2}
                        placeholder="Directives for supervisor dispatch, safety precautions, or SLA expectations..."
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                      />
                    </div>
                  </>
                )}
              </>
            ) : (
              /* Direct Assignment Mode (Legacy) */
              <>
                <div>
                  <label className="block font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-sky-600" />
                    <span>Target Municipal Department</span>
                  </label>
                  <select
                    value={primaryDept}
                    onChange={(e) => handleDeptChange(e.target.value as Department)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:bg-white focus:outline-none"
                  >
                    {CORE_DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-indigo-600" />
                    <span>Assigned Field Officer / Supervisor</span>
                  </label>
                  <select
                    value={selectedOfficer}
                    onChange={(e) => setSelectedOfficer(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:bg-white focus:outline-none"
                  >
                    {availableOfficers.map((off) => (
                      <option key={off} value={off}>
                        {off}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-slate-500" />
                    <span>Administrative Directives</span>
                  </label>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    rows={2}
                    placeholder="Enter dispatch directives..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none"
                  />
                </div>
              </>
            )}

            {/* Optional Escalation Toggle */}
            <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-2xl space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isEscalating}
                  onChange={(e) => setIsEscalating(e.target.checked)}
                  className="rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                />
                <span className="font-extrabold text-rose-900">
                  Flag as Administratively Escalated (Priority Alert)
                </span>
              </label>

              {isEscalating && (
                <div className="pt-1">
                  <input
                    type="text"
                    value={escalateReason}
                    onChange={(e) => setEscalateReason(e.target.value)}
                    placeholder="Reason for administrative escalation..."
                    className="w-full p-2 bg-white border border-rose-200 rounded-xl text-rose-900 text-xs focus:outline-none focus:ring-2 focus:ring-rose-400"
                  />
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md shadow-sky-600/20 transition flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? 'Processing...'
                    : activeMode === 'orchestration'
                    ? actionType === 'approve'
                      ? `Dispatch ${1 + supportingDepts.length} Task(s)`
                      : actionType === 'reject'
                      ? 'Confirm Rejection'
                      : 'Send Request'
                    : 'Confirm Assignment'}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

