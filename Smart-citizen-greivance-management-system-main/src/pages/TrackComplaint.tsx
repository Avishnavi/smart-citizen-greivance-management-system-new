import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useComplaints } from '../context/ComplaintContext';
import { ComplaintTimeline } from '../components/tracking/ComplaintTimeline';
import { ComplaintDetailsCard } from '../components/tracking/ComplaintDetailsCard';
import { CitizenFeedbackModal } from '../components/tracking/CitizenFeedbackModal';
import { fetchComplaintById } from '../services/complaintService';
import type { Complaint, CitizenFeedback } from '../types';
import { Search } from 'lucide-react';
import { CategoryIcon } from '../components/common/CategoryIcon';

export const TrackComplaint: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { complaints, addFeedbackToComplaint } = useComplaints();

  const urlId = searchParams.get('id') || '';
  const [searchId, setSearchId] = useState(urlId || (complaints[0]?.id ?? ''));
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (urlId) {
      const found = complaints.find(
        (c) => c.id.toLowerCase() === urlId.trim().toLowerCase()
      );
      if (found) {
        setSelectedComplaint(found);
        setSearchId(found.id);
        setSearchError(null);
      } else {
        setSearchError(`No grievance found matching ID "${urlId}". Check the ticket number.`);
      }
    } else if (complaints.length > 0 && !selectedComplaint) {
      setSelectedComplaint(complaints[0]);
      setSearchId(complaints[0].id);
    }
  }, [urlId, complaints]);

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchId.trim()) return;

    // 1. Try local list first
    const found = complaints.find(
      (c) => c.id.toLowerCase() === searchId.trim().toLowerCase()
    );

    if (found) {
      setSelectedComplaint(found);
      setSearchParams({ id: found.id });
      setSearchError(null);
      return;
    }

    // 2. Fetch live from server
    try {
      const remote = await fetchComplaintById(searchId.trim());
      if (remote) {
        setSelectedComplaint(remote);
        setSearchParams({ id: remote.id });
        setSearchError(null);
      } else {
        setSelectedComplaint(null);
        setSearchError(`No grievance ticket found for "${searchId}". Please check the ID.`);
      }
    } catch {
      setSelectedComplaint(null);
      setSearchError(`Could not find grievance "${searchId}".`);
    }
  };

  const handleQuickSelect = (complaint: Complaint) => {
    setSelectedComplaint(complaint);
    setSearchId(complaint.id);
    setSearchParams({ id: complaint.id });
    setSearchError(null);
  };

  const handleFeedbackSubmit = async (feedback: CitizenFeedback) => {
    if (!selectedComplaint) return;
    try {
      const updated = await addFeedbackToComplaint(selectedComplaint.id, feedback);
      setSelectedComplaint(updated);
    } catch (e) {
      console.error('Feedback submit error:', e);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-200">
      {/* Header & Search Bar */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3">
        <div>
          <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
            Track Ticket
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Enter ticket ID to check status and timeline.
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              placeholder="e.g. CMP-2026-001245..."
              className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
            />
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-md shadow-sky-600/20 transition flex items-center justify-center gap-1.5"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search</span>
          </button>
        </form>

        {/* Quick Select of Citizen's Active Complaints */}
        <div className="pt-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
            Recent Tickets:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {complaints.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleQuickSelect(c)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono transition flex items-center gap-1.5 border ${
                  selectedComplaint?.id === c.id
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-sky-50 hover:border-sky-200'
                }`}
              >
                <CategoryIcon category={c.category} className="w-3 h-3" />
                <span className="font-bold">{c.id}</span>
                <span className="text-[10px] opacity-80">({c.status})</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Search Error State */}
      {searchError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-center justify-between">
          <span>{searchError}</span>
          <button
            onClick={() => handleQuickSelect(complaints[0])}
            className="font-bold underline text-rose-900 ml-2"
          >
            Show latest ticket
          </button>
        </div>
      )}

      {/* Main Track View */}
      {selectedComplaint && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <ComplaintTimeline
              timeline={selectedComplaint.timeline}
              onAddFeedbackClick={() => setIsFeedbackModalOpen(true)}
              hasFeedback={Boolean(selectedComplaint.feedback)}
            />
          </div>

          <div className="space-y-6">
            <ComplaintDetailsCard complaint={selectedComplaint} />
          </div>
        </div>
      )}

      {/* Citizen Feedback Modal */}
      {selectedComplaint && (
        <CitizenFeedbackModal
          isOpen={isFeedbackModalOpen}
          onClose={() => setIsFeedbackModalOpen(false)}
          complaintId={selectedComplaint.id}
          onSubmitFeedback={handleFeedbackSubmit}
        />
      )}
    </div>
  );
};
