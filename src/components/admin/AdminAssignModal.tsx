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
  MapPin
} from 'lucide-react';

export const CORE_DEPARTMENTS: Department[] = [
  'Roads & Bridges',
  'Water Supply & Sewerage',
  'Solid Waste Management',
  'Street Lighting',
  'Storm Water Drains',
  'Public Health',
  'Traffic & Transport Department',
  'Town Planning & Enforcement',
  'Horticulture & Parks',
];

export const MUNICIPAL_OFFICERS: Record<string, string[]> = {
  'Roads & Bridges': ['Er. S. Selvam (Ward 102)', 'Er. M. Ramesh (Ward 101)', 'R. Kanna (Superintendent)'],
  'Road Maintenance Department': ['Er. S. Selvam (Ward 102)', 'Er. M. Ramesh (Ward 101)'],
  'Water Supply & Sewerage': ['A. Rahman (Asst Engineer)', 'K. Suresh (Field Tech)'],
  'Water & Sewerage Board': ['A. Rahman (Asst Engineer)', 'K. Suresh (Field Tech)'],
  'Solid Waste Management': ['M. Lakshmi (Sanitary Inspector)', 'V. Kumar (Zonal Officer)'],
  'Street Lighting': ['P. Nathan (Electrical Inspector)', 'S. Ganesh (Lineman)'],
  'Electricity & Lighting Department': ['P. Nathan (Electrical Inspector)', 'S. Ganesh (Lineman)'],
  'Storm Water Drains': ['Er. T. Baskaran (Drainage Eng)', 'G. Balaji (Field Unit)'],
  'Public Health': ['Dr. N. Meena (Health Officer)', 'S. Priya (Chief Sanitary Supv)'],
  'Public Health & Sanitation': ['Dr. N. Meena (Health Officer)', 'S. Priya (Chief Sanitary Supv)'],
};

interface AdminAssignModalProps {
  complaint: Complaint | null;
  onClose: () => void;
  onAssign: (id: string, department: Department, officerName?: string, notes?: string) => void;
  onEscalate?: (id: string, reason: string) => void;
}

export const AdminAssignModal: React.FC<AdminAssignModalProps> = ({
  complaint,
  onClose,
  onAssign,
  onEscalate,
}) => {
  const [selectedDept, setSelectedDept] = useState<Department>(
    complaint?.department || 'Roads & Bridges'
  );
  const [selectedOfficer, setSelectedOfficer] = useState<string>(
    complaint?.assignedOfficer || (complaint ? MUNICIPAL_OFFICERS[complaint.department]?.[0] : '') || 'Er. S. Selvam'
  );
  const [adminNotes, setAdminNotes] = useState<string>(complaint?.adminNotes || '');
  const [isEscalating, setIsEscalating] = useState(false);
  const [escalateReason, setEscalateReason] = useState('Critical safety hazard or SLA delay requires urgent municipal intervention.');

  if (!complaint) return null;

  const handleDeptChange = (dept: Department) => {
    setSelectedDept(dept);
    const officers = MUNICIPAL_OFFICERS[dept] || ['Zonal Officer / Supervisor'];
    setSelectedOfficer(officers[0]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAssign(complaint.id, selectedDept, selectedOfficer, adminNotes);
    if (isEscalating && onEscalate) {
      onEscalate(complaint.id, escalateReason);
    }
    onClose();
  };

  const availableOfficers = MUNICIPAL_OFFICERS[selectedDept] || ['Department Duty Officer', 'Field Supervisor'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-400/30 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-md border border-sky-400/20">
                  Municipal Command
                </span>
                <span className="text-xs font-mono font-bold text-slate-300">
                  {complaint.id}
                </span>
              </div>
              <h2 className="text-lg font-black tracking-tight mt-0.5">
                Assign / Reassign Grievance
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

        {/* Complaint Summary Card */}
        <div className="p-6 space-y-5">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CategoryIcon category={complaint.category} className="w-4 h-4" />
                <span className="font-bold text-slate-900">{complaint.category}</span>
              </div>
              <PriorityBadge priority={complaint.priority} size="sm" />
            </div>
            <p className="text-slate-700 leading-relaxed font-normal">
              {complaint.description}
            </p>
            <div className="flex items-center gap-1.5 text-slate-500 text-[11px] pt-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>{complaint.location.address}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Department Selection */}
            <div>
              <label className="block font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-sky-600" />
                <span>Target Municipal Department</span>
              </label>
              <select
                value={selectedDept}
                onChange={(e) => handleDeptChange(e.target.value as Department)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
              >
                {CORE_DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            {/* Officer Assignment */}
            <div>
              <label className="block font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-indigo-600" />
                <span>Assigned Field Officer / Supervisor</span>
              </label>
              <select
                value={selectedOfficer}
                onChange={(e) => setSelectedOfficer(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                {availableOfficers.map((off) => (
                  <option key={off} value={off}>
                    {off}
                  </option>
                ))}
              </select>
            </div>

            {/* Administrative Directives / Notes */}
            <div>
              <label className="block font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-slate-500" />
                <span>Administrative Directives / Priority Instructions</span>
              </label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={3}
                placeholder="Enter administrative dispatch instructions, priority timelines, or SLA mandates..."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
              />
            </div>

            {/* Optional Escalation Toggle */}
            <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-2xl space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isEscalating}
                  onChange={(e) => setIsEscalating(e.target.checked)}
                  className="rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                />
                <span className="font-extrabold text-rose-900">
                  Flag as Administratively Escalated (Priority Boost & SLA Alert)
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
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-md shadow-sky-600/20 transition flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm Assignment</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
