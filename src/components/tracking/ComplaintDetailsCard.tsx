import React, { useState } from 'react';
import type { Complaint } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { PriorityBadge } from '../common/PriorityBadge';
import { CategoryIcon } from '../common/CategoryIcon';
import { formatDateTime, formatDate } from '../../utils/dateUtils';
import { reopenComplaintApi, submitClarificationApi } from '../../services/complaintService';
import {
  MapPin,
  Building,
  Volume2,
  CheckCircle2,
  Star,
  Camera,
  ExternalLink,
  User,
  Layers,
  RotateCcw,
  AlertCircle,
  X,
} from 'lucide-react';

interface ComplaintDetailsCardProps {
  complaint: Complaint;
  onRefresh?: () => void;
}

export const ComplaintDetailsCard: React.FC<ComplaintDetailsCardProps> = ({
  complaint,
  onRefresh,
}) => {
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [isReopenOpen, setIsReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [isReopening, setIsReopening] = useState(false);
  const [reopenSuccess, setReopenSuccess] = useState<string | null>(null);

  // Clarification states
  const [clarificationText, setClarificationText] = useState('');
  const [isSubmittingClarification, setIsSubmittingClarification] = useState(false);
  const [clarificationSuccess, setClarificationSuccess] = useState<string | null>(null);

  const handleReopenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopenReason.trim()) return;
    setIsReopening(true);
    try {
      await reopenComplaintApi(complaint.id, reopenReason.trim());
      setReopenSuccess('Grievance has been reopened and queued for Central Admin / Supervisor review.');
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to reopen complaint.');
    } finally {
      setIsReopening(false);
    }
  };

  const handleClarificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clarificationText.trim()) return;
    setIsSubmittingClarification(true);
    try {
      await submitClarificationApi(complaint.id, clarificationText.trim());
      setClarificationSuccess('Clarification response submitted. Your ticket has been returned to Central Admin for triage.');
      setClarificationText('');
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to submit clarification.');
    } finally {
      setIsSubmittingClarification(false);
    }
  };

  const hasMultipleTasks = (complaint.taskCount && complaint.taskCount > 1) || (complaint.departments?.supporting?.length || 0) > 0;
  const isResolvableState = ['Resolved', 'Closed', 'RESOLVED', 'CLOSED'].includes(complaint.status as string);
  const isClarificationState =
    (complaint.status as string) === 'CLARIFICATION_REQUIRED' ||
    complaint.adminApproval?.status === 'clarification_required';

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-sky-50 text-sky-600 rounded-2xl border border-sky-100 shadow-xs">
            <CategoryIcon category={complaint.category} className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-extrabold text-base sm:text-lg text-slate-900">
                {complaint.id}
              </span>
              <span className="px-2 py-0.5 text-xs font-bold bg-slate-100 text-slate-700 rounded-md">
                {complaint.category}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Submitted on {formatDateTime(complaint.createdAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <PriorityBadge priority={complaint.priority} size="md" />
          <StatusBadge status={complaint.status} size="md" />
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
          Citizen Problem Statement
        </span>
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs sm:text-sm text-slate-800 leading-relaxed font-normal">
          "{complaint.description}"
        </div>
      </div>

      {/* Clarification Request Banner */}
      {isClarificationState && (
        <div className="p-4 sm:p-5 bg-amber-50 border border-amber-200 rounded-2xl space-y-3">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-500 text-white rounded-xl shadow-xs shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="flex-1 space-y-1">
              <h4 className="font-extrabold text-sm text-amber-950">
                Action Required: Administrative Clarification Requested
              </h4>
              <p className="text-xs text-amber-900 leading-relaxed">
                Central Admin reviewed your ticket and requested additional clarification:
              </p>
              {complaint.adminApproval?.adminNotes && (
                <div className="p-3 bg-white/90 border border-amber-200 rounded-xl text-xs font-medium text-amber-950 italic mt-1">
                  "{complaint.adminApproval.adminNotes}"
                </div>
              )}
            </div>
          </div>

          {clarificationSuccess ? (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{clarificationSuccess}</span>
            </div>
          ) : (
            <form onSubmit={handleClarificationSubmit} className="space-y-2.5 pt-1">
              <textarea
                value={clarificationText}
                onChange={(e) => setClarificationText(e.target.value)}
                rows={3}
                placeholder="Provide the requested details or landmarks..."
                required
                className="w-full p-3 bg-white border border-amber-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmittingClarification || clarificationText.trim().length < 5}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
                >
                  {isSubmittingClarification ? 'Submitting...' : 'Submit Clarification'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Media Attachments: Audio & Photos */}
      {(complaint.voiceUrl || (complaint.imageUrls && complaint.imageUrls.length > 0)) && (
        <div className="space-y-3">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Media Attachments
          </span>

          {/* Voice Audio Player */}
          {complaint.voiceUrl && (
            <div className="p-3.5 bg-rose-50/60 border border-rose-200/80 rounded-2xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-600 text-white rounded-xl shadow-xs">
                  <Volume2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    Citizen Voice Recording
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {complaint.voiceDuration || 8}s Audio Note
                  </span>
                </div>
              </div>

              <audio controls src={complaint.voiceUrl} className="h-8 max-w-[200px] sm:max-w-xs" />
            </div>
          )}

          {/* Photo Gallery */}
          {complaint.imageUrls && complaint.imageUrls.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {complaint.imageUrls.map((img, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedPhoto(img)}
                  className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-video bg-slate-100 cursor-pointer shadow-xs"
                >
                  <img
                    src={img}
                    alt={`Attachment ${i + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition"
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-semibold">
                    <span>Enlarge</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Grid of Details: Location, Department, SLA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Location Info */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5">
          <div className="flex items-center gap-2 text-slate-700">
            <MapPin className="w-4 h-4 text-sky-600 shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Location Details
            </span>
          </div>
          <p className="text-xs font-bold text-slate-800 pt-1 leading-snug">
            {complaint.location?.address || 'Location registered'}
          </p>
          <div className="text-[11px] text-slate-500 font-mono space-y-0.5">
            {(complaint.location?.ward || complaint.location?.zone) && (
              <p>{[complaint.location?.ward, complaint.location?.zone].filter(Boolean).join(' • ')}</p>
            )}
            {typeof complaint.location?.latitude === 'number' && typeof complaint.location?.longitude === 'number' && (
              <p>{complaint.location.latitude.toFixed(4)}° N, {complaint.location.longitude.toFixed(4)}° E</p>
            )}
          </div>
        </div>

        {/* Department & Officer Info */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5">
          <div className="flex items-center gap-2 text-slate-700">
            <Building className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Assigned Department
            </span>
          </div>
          <p className="text-xs font-bold text-slate-800 pt-1">
            {complaint.department || 'Municipal Administration'}
          </p>
          {complaint.assignedOfficer && (
            <div className="flex items-center gap-1.5 pt-1 text-xs text-slate-700 bg-white/70 px-2.5 py-1 rounded-lg border border-slate-200/60 w-fit">
              <User className="w-3.5 h-3.5 text-indigo-600" />
              <span>Officer: <strong className="font-semibold text-slate-900">{complaint.assignedOfficer}</strong></span>
            </div>
          )}
          <div className="text-[11px] text-slate-500 space-y-0.5 pt-0.5">
            <p>SLA Resolution Target: <strong className="text-slate-700">48 - 72 Hours</strong></p>
            <p>Ticket Priority: <strong className="text-slate-700">{complaint.priority} (Score {complaint.priorityScore || 70}/100)</strong></p>
          </div>
        </div>
      </div>

      {/* Multi-Department Task Progress (Phase 2 Breakdown) */}
      {hasMultipleTasks && (
        <div className="p-4 bg-gradient-to-r from-sky-50/50 via-slate-50 to-indigo-50/50 rounded-2xl border border-sky-100 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-600" />
              <span className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
                Multi-Department Action Breakdown
              </span>
            </div>
            <span className="text-[11px] font-bold text-sky-800 bg-sky-100 px-2.5 py-0.5 rounded-full">
              {complaint.tasksCompleted || 0} of {complaint.taskCount || 2} Tasks Completed
            </span>
          </div>

          <div className="space-y-2 text-xs">
            {/* Primary Department */}
            <div className="p-3 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded-md border border-sky-200">
                  Primary Lead
                </span>
                <p className="font-bold text-slate-800 mt-1">
                  {complaint.departments?.primary?.departmentName || complaint.department}
                </p>
                <p className="text-[11px] text-slate-500">
                  {complaint.departments?.primary?.description || 'Lead civic repair and coordination'}
                </p>
              </div>
              <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">
                Lead Department
              </span>
            </div>

            {/* Supporting Departments */}
            {complaint.departments?.supporting?.map((sd, idx) => (
              <div key={idx} className="p-3 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-200">
                    Supporting Unit {idx + 1}
                  </span>
                  <p className="font-bold text-slate-800 mt-1">{sd.departmentName}</p>
                  <p className="text-[11px] text-slate-500">{sd.reason || 'Auxiliary technical assistance'}</p>
                </div>
                <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-lg">
                  Supporting
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resolution Card if resolved */}
      {complaint.resolution && (
        <div className="p-5 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-900 font-extrabold text-xs uppercase tracking-wider">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Resolution & Field Closure Report</span>
            </div>
            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-200/80 px-2 py-0.5 rounded-full">
              Field Work Verified
            </span>
          </div>

          {complaint.resolution.proofImageUrl && (
            <div className="rounded-2xl overflow-hidden border border-emerald-200 bg-white shadow-xs max-w-md">
              <img
                src={complaint.resolution.proofImageUrl}
                alt="Resolution Proof"
                className="w-full h-48 sm:h-56 object-cover"
              />
              <div className="p-2.5 bg-emerald-50/90 border-t border-emerald-100 flex items-center justify-between text-[11px] text-emerald-800">
                <span className="font-bold flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-emerald-600" />
                  Official Field Resolution Photo
                </span>
                <a
                  href={complaint.resolution.proofImageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1 hover:underline"
                >
                  <span>Full View</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}

          <p className="text-xs text-emerald-950 leading-relaxed italic bg-white/80 p-3 rounded-xl border border-emerald-100">
            "{complaint.resolution.resolutionNotes}"
          </p>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-emerald-800 pt-1">
            <span>Verified by: <strong>{complaint.resolution.officerName}</strong></span>
            <span>Closed on: <strong>{formatDate(complaint.resolution.resolvedAt)}</strong></span>
          </div>
        </div>
      )}

      {/* Citizen Feedback Rating if provided */}
      {complaint.feedback && (
        <div className="p-5 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs uppercase tracking-wider">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span>Citizen Satisfaction Rating</span>
            </div>
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`w-3.5 h-3.5 ${
                    i < complaint.feedback!.rating
                      ? 'text-amber-500 fill-amber-500'
                      : 'text-slate-300'
                  }`}
                />
              ))}
            </div>
          </div>
          {complaint.feedback.comment && (
            <p className="text-xs text-slate-700 italic">
              "{complaint.feedback.comment}"
            </p>
          )}
          {complaint.feedback.tags && complaint.feedback.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {complaint.feedback.tags.map((t, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 text-[10px] font-bold bg-white text-amber-900 border border-amber-200 rounded-md"
                >
                  ✓ {t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Citizen Reopen Option if Resolved or Closed */}
      {isResolvableState && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-200 text-slate-700 rounded-xl">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-xs text-slate-900 block">
                Not satisfied with this resolution?
              </span>
              <span className="text-[11px] text-slate-500">
                You can request an administrative review or reopen this grievance within the review window.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsReopenOpen(true)}
            className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl transition shrink-0"
          >
            Appeal / Reopen
          </button>
        </div>
      )}

      {/* Reopen Modal */}
      {isReopenOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-900 p-5 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400" />
                <h3 className="font-black text-sm">Request Grievance Reopening</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsReopenOpen(false)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReopenSubmit} className="p-5 space-y-4 text-xs">
              {reopenSuccess ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl font-medium">
                  {reopenSuccess}
                </div>
              ) : (
                <>
                  <p className="text-slate-600">
                    Please describe why the completed work does not adequately resolve your grievance.
                  </p>
                  <textarea
                    rows={3}
                    value={reopenReason}
                    onChange={(e) => setReopenReason(e.target.value)}
                    placeholder="e.g. Debris was left behind on the sidewalk; pothole filled unevenly..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none"
                    required
                  />
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsReopenOpen(false)}
                      className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isReopening}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs transition"
                    >
                      {isReopening ? 'Submitting...' : 'Submit Reopen Request'}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Modal for photo enlargement */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-2xl max-h-[85vh]">
            <img
              src={selectedPhoto}
              alt="Enlarged evidence"
              className="max-h-[80vh] w-auto rounded-2xl shadow-2xl object-contain"
            />
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-3 right-3 px-3 py-1.5 bg-black/60 hover:bg-black text-white text-xs font-bold rounded-xl"
            >
              Close ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
