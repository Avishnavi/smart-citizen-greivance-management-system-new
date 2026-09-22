import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useComplaints } from '../context/ComplaintContext';
import { StatCard } from '../components/common/StatCard';
import { ComplaintCard } from '../components/history/ComplaintCard';
import { CIVIC_ALERTS } from '../mock/notifications';
import { fetchDashboardStatistics, type DashboardStatistics } from '../services/complaintService';
import {
  PlusCircle,
  Search,
  History,
  Layers,
  Clock,
  RefreshCw,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Megaphone,
  MapPin
} from 'lucide-react';

export const Home: React.FC = () => {
  const { profile } = useAuth();
  const { complaints } = useComplaints();
  const [stats, setStats] = useState<DashboardStatistics | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardStatistics().then((data) => {
      if (data) setStats(data);
    });
  }, [complaints]);

  const totalCount = stats?.totalComplaints ?? complaints.length;
  const pendingCount = stats?.pendingComplaints ?? complaints.filter((c) => c.status === 'Pending').length;
  const inProgressCount = stats?.inProgressComplaints ?? complaints.filter((c) => c.status === 'In Progress').length;
  const resolvedCount = stats?.resolvedComplaints ?? complaints.filter((c) => c.status === 'Resolved').length;

  const recentComplaints = complaints.slice(0, 3);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Header & Welcome Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 sm:p-8 text-white shadow-2xl border border-slate-800/80">
        {/* Ambient Glowing Orbs */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-sky-500/15 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/3 -mb-20 w-64 h-64 rounded-full bg-indigo-500/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img
                  src={profile.avatar}
                  alt={profile.name}
                  className="w-12 h-12 rounded-2xl object-cover ring-2 ring-sky-400/40 shadow-lg"
                />
                <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-950 rounded-full" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-400/30 px-2 py-0.5 rounded-md">
                    Ward {profile.ward}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400">
                    ID #{profile.id}
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight mt-0.5 text-white">
                  Welcome, {profile.name}
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-300 font-medium">
              <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-xl border border-white/10">
                <MapPin className="w-3.5 h-3.5 text-sky-400" />
                <span>{profile.zone}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20 text-emerald-300">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verified</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-row sm:flex-col gap-2.5 flex-shrink-0">
            <Link
              to="/register"
              className="group px-4 py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-xs rounded-2xl shadow-lg shadow-sky-500/20 transition hover:scale-[1.02] flex items-center justify-center gap-2 border border-white/20"
            >
              <PlusCircle className="w-4 h-4 group-hover:rotate-90 transition duration-300" />
              <span>Report Issue</span>
            </Link>

            <Link
              to="/track"
              className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white text-xs font-semibold rounded-2xl transition flex items-center justify-center gap-1.5 border border-white/10"
            >
              <Search className="w-3.5 h-3.5 text-sky-300" />
              <span>Track</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Civic Alert */}
      {CIVIC_ALERTS.length > 0 && (
        <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-3 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 bg-amber-500 text-white rounded-xl flex-shrink-0">
              <Megaphone className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-amber-950 truncate">
              {CIVIC_ALERTS[0].title}
            </span>
            <span className="hidden sm:inline text-[10px] font-extrabold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
              Advisory
            </span>
          </div>
          <span className="text-[10px] font-semibold text-slate-400 whitespace-nowrap bg-white px-2 py-0.5 rounded-md border border-slate-200/60">
            {CIVIC_ALERTS[0].date}
          </span>
        </div>
      )}

      {/* 3. Complaint Summary Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-900 tracking-tight">
            Overview
          </h2>
          <span className="text-[11px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-lg border border-sky-100">
            Ward {profile.ward}
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            title="Total"
            count={totalCount}
            icon={Layers}
            colorScheme="slate"
            onClick={() => navigate('/history?status=All')}
          />
          <StatCard
            title="Pending"
            count={pendingCount}
            icon={Clock}
            colorScheme="amber"
            onClick={() => navigate('/history?status=Pending')}
          />
          <StatCard
            title="In Progress"
            count={inProgressCount}
            icon={RefreshCw}
            colorScheme="sky"
            onClick={() => navigate('/history?status=In Progress')}
          />
          <StatCard
            title="Resolved"
            count={resolvedCount}
            icon={CheckCircle2}
            colorScheme="emerald"
            onClick={() => navigate('/history?status=Resolved')}
          />
        </div>
      </div>

      {/* 4. Recent Complaints Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-900 tracking-tight">
            Recent Issues
          </h2>

          <Link
            to="/history"
            className="text-xs font-bold text-sky-600 hover:text-sky-800 flex items-center gap-1 px-2.5 py-1 rounded-xl bg-sky-50 hover:bg-sky-100 transition group"
          >
            <span>View All ({totalCount})</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
          </Link>
        </div>

        {recentComplaints.length === 0 ? (
          <div className="p-6 text-center bg-white rounded-2xl border border-slate-200/80 text-slate-400 text-xs font-medium">
            No complaints logged
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {recentComplaints.map((complaint) => (
              <ComplaintCard key={complaint.id} complaint={complaint} />
            ))}
          </div>
        )}
      </div>

      {/* 5. Quick Actions Section */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
        <h2 className="text-sm font-black text-slate-900 tracking-tight">
          Services
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            to="/register"
            className="p-3.5 rounded-2xl border border-slate-200/80 hover:border-sky-300 hover:bg-sky-50/40 transition group flex items-center gap-3"
          >
            <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl group-hover:scale-105 group-hover:bg-sky-600 group-hover:text-white transition duration-200">
              <PlusCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-xs text-slate-900">
                Report Issue
              </h3>
              <p className="text-[10px] text-slate-400">
                Voice • Photo • Text
              </p>
            </div>
          </Link>

          <Link
            to="/track"
            className="p-3.5 rounded-2xl border border-slate-200/80 hover:border-indigo-300 hover:bg-indigo-50/40 transition group flex items-center gap-3"
          >
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl group-hover:scale-105 group-hover:bg-indigo-600 group-hover:text-white transition duration-200">
              <Search className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-xs text-slate-900">
                Track Ticket
              </h3>
              <p className="text-[10px] text-slate-400">
                Status & Timeline
              </p>
            </div>
          </Link>

          <Link
            to="/history"
            className="p-3.5 rounded-2xl border border-slate-200/80 hover:border-emerald-300 hover:bg-emerald-50/40 transition group flex items-center gap-3"
          >
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-105 group-hover:bg-emerald-600 group-hover:text-white transition duration-200">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-xs text-slate-900">
                History
              </h3>
              <p className="text-[10px] text-slate-400">
                Records & Feedback
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};
