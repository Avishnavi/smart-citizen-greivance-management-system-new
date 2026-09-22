import React, { useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useComplaints } from '../context/ComplaintContext';
import { ComplaintCard } from '../components/history/ComplaintCard';
import { EmptyState } from '../components/common/EmptyState';
import type { ComplaintStatus } from '../types';
import {
  Search,
  PlusCircle,
  Download,
  History
} from 'lucide-react';

export const ComplaintHistory: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { complaints } = useComplaints();
  const navigate = useNavigate();

  const statusFilter = (searchParams.get('status') as ComplaintStatus | 'All') || 'All';
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'newest' | 'priority'>('newest');

  const filterTabs: Array<'All' | ComplaintStatus> = [
    'All',
    'Pending',
    'In Progress',
    'Resolved'
  ];

  const handleTabChange = (tab: 'All' | ComplaintStatus) => {
    setSearchParams({ status: tab });
  };

  const filteredComplaints = useMemo(() => {
    return complaints
      .filter((c) => {
        if (statusFilter !== 'All' && c.status !== statusFilter) {
          return false;
        }
        if (categoryFilter !== 'All' && c.category !== categoryFilter) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchId = c.id.toLowerCase().includes(q);
          const matchCat = c.category.toLowerCase().includes(q);
          const matchDesc = c.description.toLowerCase().includes(q);
          const matchLoc = c.location.address.toLowerCase().includes(q);
          if (!matchId && !matchCat && !matchDesc && !matchLoc) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'priority') {
          const pOrder = { High: 3, Medium: 2, Low: 1 };
          return (pOrder[b.priority] || 0) - (pOrder[a.priority] || 0);
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [complaints, statusFilter, categoryFilter, searchQuery, sortBy]);

  const uniqueCategories = useMemo(() => {
    const cats = new Set(complaints.map((c) => c.category));
    return ['All', ...Array.from(cats)];
  }, [complaints]);

  const handleExportCSV = () => {
    const headers = 'ID,Category,Department,Priority,Status,Created At,Address\n';
    const rows = filteredComplaints
      .map(
        (c) =>
          `"${c.id}","${c.category}","${c.department}","${c.priority}","${c.status}","${c.createdAt}","${c.location.address.replace(/"/g, '""')}"`
      )
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `grievance_history_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            History
          </h1>
          <p className="mt-0.5 text-xs text-slate-400">
            Search and track all registered issues.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 shadow-2xs transition flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/register')}
            className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Issue</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Control Panel */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-100">
          {filterTabs.map((tab) => {
            const count =
              tab === 'All'
                ? complaints.length
                : complaints.filter((c) => c.status === tab).length;

            const isActive = statusFilter === tab;

            return (
              <button
                key={tab}
                type="button"
                onClick={() => handleTabChange(tab)}
                className={`px-4 py-2 rounded-2xl text-xs font-bold transition whitespace-nowrap flex items-center gap-2 ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/20'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span>{tab}</span>
                <span
                  className={`px-1.5 py-0.2 text-[10px] rounded-full font-extrabold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Bar + Category Dropdown + Sorting */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by complaint ID or category (e.g. CMP-2026-001245, Pothole, Anna Nagar)..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
            />
          </div>

          <div className="sm:col-span-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            >
              {uniqueCategories.map((cat) => (
                <option key={cat} value={cat}>
                  Category: {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-3">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'newest' | 'priority')}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            >
              <option value="newest">Sort: Newest First</option>
              <option value="priority">Sort: Highest Priority</option>
            </select>
          </div>
        </div>
      </div>

      {/* Complaint Cards Grid */}
      {filteredComplaints.length === 0 ? (
        <EmptyState
          icon={History}
          title="No complaints match your criteria"
          description="Try changing your search terms or adjusting the status/category filters."
          actionText="Clear Filters"
          onAction={() => {
            setSearchQuery('');
            setCategoryFilter('All');
            setSearchParams({ status: 'All' });
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredComplaints.map((complaint) => (
            <ComplaintCard key={complaint.id} complaint={complaint} />
          ))}
        </div>
      )}
    </div>
  );
};
