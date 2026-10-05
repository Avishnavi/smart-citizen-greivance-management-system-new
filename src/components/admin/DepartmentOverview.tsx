import React, { useMemo } from 'react';
import type { Complaint, Department } from '../../types';
import {
  Building2,
  ArrowRight,
  Hammer,
  Droplets,
  Zap,
  Trash2,
  Waves,
  HeartPulse,
  UserCheck,
  AlertTriangle,
} from 'lucide-react';

export const SIX_CORE_DEPARTMENTS: {
  name: Department;
  aliases: string[];
  icon: React.ReactNode;
  activeOfficers: number;
  description: string;
}[] = [
  {
    name: 'Roads & Bridges',
    aliases: ['Roads & Bridges', 'Road Maintenance Department'],
    icon: <Hammer className="w-5 h-5 text-amber-600" />,
    activeOfficers: 14,
    description: 'Pothole restoration, arterial road resurfacing, bridge maintenance, and speed-breaker leveling.',
  },
  {
    name: 'Water Supply & Sewerage',
    aliases: ['Water Supply & Sewerage', 'Water & Sewerage Board'],
    icon: <Droplets className="w-5 h-5 text-sky-600" />,
    activeOfficers: 18,
    description: 'Drinking water pipeline leaks, contamination checks, sewer desilting, and supply pressure monitoring.',
  },
  {
    name: 'Solid Waste Management',
    aliases: ['Solid Waste Management'],
    icon: <Trash2 className="w-5 h-5 text-emerald-600" />,
    activeOfficers: 24,
    description: 'Door-to-door garbage collection, compactor bins clearing, street sweeping, and composting centers.',
  },
  {
    name: 'Street Lighting',
    aliases: ['Street Lighting', 'Electricity & Lighting Department'],
    icon: <Zap className="w-5 h-5 text-yellow-500" />,
    activeOfficers: 11,
    description: 'LED fixture replacements, underground feeder cables, high-mast lamps, and timer relays.',
  },
  {
    name: 'Storm Water Drains',
    aliases: ['Storm Water Drains'],
    icon: <Waves className="w-5 h-5 text-indigo-600" />,
    activeOfficers: 12,
    description: 'Monsoon canal dredging, drain silt removal, culvert desiltation, and flood mitigation pumps.',
  },
  {
    name: 'Public Health',
    aliases: ['Public Health', 'Public Health & Sanitation'],
    icon: <HeartPulse className="w-5 h-5 text-rose-600" />,
    activeOfficers: 16,
    description: 'Vector control spraying, stray animal vaccination, civic hygiene inspections, and medical advisories.',
  },
];

interface DepartmentOverviewProps {
  complaints: Complaint[];
  onFilterByDepartment?: (dept: Department) => void;
  onReassignDepartment?: (dept: Department) => void;
}

export const DepartmentOverview: React.FC<DepartmentOverviewProps> = ({
  complaints,
  onFilterByDepartment,
}) => {
  const stats = useMemo(() => {
    return SIX_CORE_DEPARTMENTS.map((dept) => {
      const deptComplaints = complaints.filter((c) =>
        dept.aliases.includes(c.department)
      );
      const total = deptComplaints.length;
      const pending = deptComplaints.filter((c) => c.status === 'Pending').length;
      const inProgress = deptComplaints.filter((c) => c.status === 'In Progress').length;
      const resolved = deptComplaints.filter((c) => c.status === 'Resolved').length;
      const highPriority = deptComplaints.filter((c) => c.priority === 'High' && c.status !== 'Resolved').length;
      const slaCompliance = total > 0 ? Math.round((resolved / total) * 100) : 100;

      const workloadIndex = total > 8 ? 'Overloaded' : total > 4 ? 'Moderate' : 'Optimal';

      return {
        ...dept,
        total,
        pending,
        inProgress,
        resolved,
        highPriority,
        slaCompliance,
        workloadIndex,
      };
    });
  }, [complaints]);

  const totalAssigned = complaints.length;
  const totalResolved = complaints.filter((c) => c.status === 'Resolved').length;
  const citywideRate = totalAssigned > 0 ? Math.round((totalResolved / totalAssigned) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-sky-100 text-sky-700 rounded-xl">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Department Overview & Workload
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[11px] font-semibold">6 Divisions</span>
                <span className="px-2 py-0.5 bg-sky-100 text-sky-700 rounded-md text-[11px] font-semibold">Live Triage</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-center">
            <span className="text-slate-400 block text-[10px] font-bold uppercase">Core Divisions</span>
            <span className="font-extrabold text-slate-900 text-sm">6 Municipal Depts</span>
          </div>
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
            <span className="text-emerald-700 block text-[10px] font-bold uppercase">Citywide SLA</span>
            <span className="font-extrabold text-emerald-900 text-sm">{citywideRate}%</span>
          </div>
        </div>
      </div>

      {/* Grid of 6 Core Department Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {stats.map((item) => (
          <div
            key={item.name}
            className="bg-white rounded-3xl p-6 border border-slate-200 hover:border-sky-300 hover:shadow-md transition-all flex flex-col justify-between space-y-4 text-xs"
          >
            <div>
              {/* Header: Icon, Name, Workload Badge */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-100">
                    {item.icon}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm leading-snug">
                      {item.name}
                    </h3>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                      <UserCheck className="w-3 h-3 text-slate-400" />
                      <span>{item.activeOfficers} Active Officers</span>
                    </div>
                  </div>
                </div>

                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    item.workloadIndex === 'Overloaded'
                      ? 'bg-rose-100 text-rose-800'
                      : item.workloadIndex === 'Moderate'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {item.workloadIndex}
                </span>
              </div>
            </div>

            {/* Metrics Matrix */}
            <div className="grid grid-cols-4 gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-100 text-center">
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold">Total</span>
                <span className="font-black text-slate-900 text-sm">{item.total}</span>
              </div>
              <div>
                <span className="text-[10px] text-amber-600 block font-semibold">Pending</span>
                <span className="font-black text-amber-900 text-sm">{item.pending}</span>
              </div>
              <div>
                <span className="text-[10px] text-indigo-600 block font-semibold">In Work</span>
                <span className="font-black text-indigo-900 text-sm">{item.inProgress}</span>
              </div>
              <div>
                <span className="text-[10px] text-emerald-600 block font-semibold">Resolved</span>
                <span className="font-black text-emerald-900 text-sm">{item.resolved}</span>
              </div>
            </div>

            {/* High Priority Alerts in Dept */}
            {item.highPriority > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-700 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
                <span>{item.highPriority} High-Priority Emergency Hazard(s)</span>
              </div>
            )}

            {/* SLA Progress Bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-medium">SLA Resolution Rate</span>
                <span className="font-black text-slate-800">{item.slaCompliance}%</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    item.slaCompliance >= 70
                      ? 'bg-emerald-500'
                      : item.slaCompliance >= 40
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                  style={{ width: `${item.slaCompliance}%` }}
                />
              </div>
            </div>

            {/* Action Buttons */}
            {onFilterByDepartment && (
              <button
                type="button"
                onClick={() => onFilterByDepartment(item.name)}
                className="w-full py-2.5 bg-slate-50 hover:bg-sky-50 text-slate-700 hover:text-sky-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 border border-slate-200 hover:border-sky-200 transition active:scale-98 cursor-pointer"
              >
                <span>View & Manage Complaints</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
