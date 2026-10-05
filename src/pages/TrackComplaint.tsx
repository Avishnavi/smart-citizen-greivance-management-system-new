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

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    if (urlId) {
      setSearchId(urlId);
      const found = complaints.find(
        (c) => c.id.toLowerCase() === urlId.trim().toLowerCase()
      );
      if (found) {
        setSelectedComplaint(found);
        setSearchError(null);
      }

      // Fetch live details and timeline from backend
      setIsLoading(true);
      fetchComplaintById(urlId.trim())
        .then((remote) => {
          if (isCancelled) return;
          if (remote) {
            setSelectedComplaint(remote);
            setSearchError(null);
          } else if (!found) {
            setSelectedComplaint(null);
            setSearchError(`No grievance found matching ID "${urlId}". Check the ticket number.`);
          }
        })
        .catch(() => {
          if (isCancelled) return;
          if (!found) {
            setSelectedComplaint(null);
            setSearchError(`Could not find grievance "${urlId}".`);
          }
        })
        .finally(() => {
          if (!isCancelled) setIsLoading(false);
        });
    } else if (complaints.length > 0 && !selectedComplaint) {
      setSelectedComplaint(complaints[0]);
      setSearchId(complaints[0].id);
    }

    return () => {
      isCancelled = true;
    };
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
    setIsLoading(true);
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
    } finally {
      setIsLoading(false);
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
            disabled={isLoading}
            className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md shadow-sky-600/20 transition flex items-center justify-center gap-1.5"
          >
            <Search className="w-3.5 h-3.5" />
            <span>{isLoading ? 'Searching...' : 'Search'}</span>
          </button>
        </form>

        {/* Quick Select of Citizen's Active Complaints */}
        {complaints.length > 0 && (
          <div className="pt-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Recent Tickets:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {complaints.slice(0, 5).map((c) => (
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
        )}
      </div>

      {/* Loading Skeleton */}
      {isLoading && !selectedComplaint && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start animate-pulse">
          <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
            <div className="flex justify-between items-center pb-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-200" />
                <div className="space-y-2">
                  <div className="w-32 h-5 bg-slate-200 rounded-md" />
                  <div className="w-48 h-3 bg-slate-100 rounded-md" />
                </div>
              </div>
              <div className="w-24 h-7 bg-slate-200 rounded-full" />
            </div>
            <div className="space-y-2">
              <div className="w-36 h-3 bg-slate-200 rounded-md" />
              <div className="w-full h-16 bg-slate-100 rounded-2xl" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="h-28 bg-slate-100 rounded-2xl" />
              <div className="h-28 bg-slate-100 rounded-2xl" />
            </div>
          </div>
          <div className="lg:col-span-1 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
            <div className="w-40 h-5 bg-slate-200 rounded-md" />
            <div className="space-y-6 pt-2">
              <div className="h-16 bg-slate-100 rounded-2xl" />
              <div className="h-16 bg-slate-100 rounded-2xl" />
              <div className="h-16 bg-slate-100 rounded-2xl" />
            </div>
          </div>
        </div>
      )}

      {/* Complaint Not Found State */}
      {!isLoading && !selectedComplaint && (
        <div className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-200 shadow-sm text-center max-w-xl mx-auto space-y-4">
          <div className="w-14 h-14 bg-amber-50 text-amber-600 border border-amber-200 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
            <Search className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-black text-slate-900">
              Grievance Ticket Not Found
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
              {searchError || `No ticket matches "${searchId}". Please check the ID or select one of your recent complaints.`}
            </p>
          </div>
          {complaints.length > 0 && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => handleQuickSelect(complaints[0])}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition"
              >
                View Latest Ticket ({complaints[0].id})
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Track View */}
      {selectedComplaint && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Primary Left Column: Complaint Details Card */}
          <div className="lg:col-span-2 space-y-6">
            <ComplaintDetailsCard complaint={selectedComplaint} />
          </div>

          {/* Right Column: Workflow Timeline Progress */}
          <div className="lg:col-span-1 space-y-6">
            <ComplaintTimeline
              timeline={selectedComplaint.timeline}
              onAddFeedbackClick={() => setIsFeedbackModalOpen(true)}
              hasFeedback={Boolean(selectedComplaint.feedback)}
            />
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
