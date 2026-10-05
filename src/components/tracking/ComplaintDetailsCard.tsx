import React, { useState } from 'react';
import type { Complaint } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { PriorityBadge } from '../common/PriorityBadge';
import { CategoryIcon } from '../common/CategoryIcon';
import {
  MapPin,
  Building,
  Volume2,
  CheckCircle2,
  Star,
  Camera,
  ExternalLink,
  User,
} from 'lucide-react';

interface ComplaintDetailsCardProps {
  complaint: Complaint;
}

export const ComplaintDetailsCard: React.FC<ComplaintDetailsCardProps> = ({
  complaint
}) => {
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

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
              Submitted on{' '}
              {complaint.createdAt
                ? `${new Date(complaint.createdAt).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })} at ${new Date(complaint.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`
                : 'Recently'}
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
            <span>Closed on: <strong>{new Date(complaint.resolution.resolvedAt).toLocaleDateString()}</strong></span>
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
