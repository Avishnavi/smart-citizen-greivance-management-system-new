import React from 'react';
import type { DuplicateDetectionResult } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { PriorityBadge } from '../common/PriorityBadge';
import {
  AlertTriangle,
  ExternalLink,
  PlusCircle,
  FilePlus2,
  MapPin,
  Clock
} from 'lucide-react';

interface DuplicateAlertCardProps {
  duplicate: DuplicateDetectionResult;
  selectedAction?: 'view' | 'upvote' | 'submit_new';
  onSelectAction: (action: 'view' | 'upvote' | 'submit_new') => void;
}

export const DuplicateAlertCard: React.FC<DuplicateAlertCardProps> = ({
  duplicate,
  selectedAction,
  onSelectAction
}) => {
  const existing = duplicate.existingComplaint;

  return (
    <div className="bg-gradient-to-br from-amber-500/10 via-amber-50 to-orange-50 border-2 border-amber-300 rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm animate-in fade-in">
      {/* Alert Header */}
      <div className="flex items-start gap-3">
        <div className="p-2.5 bg-amber-500 text-white rounded-2xl shadow-sm flex-shrink-0">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-extrabold text-amber-950">
              ⚠️ Similar Complaint Found Nearby
            </h3>
            <span className="px-2 py-0.5 text-[10px] font-extrabold bg-amber-200 text-amber-900 rounded-full">
              {Math.round((duplicate.similarityScore || 0.85) * 100)}% Match
            </span>
          </div>
          <p className="mt-0.5 text-xs text-amber-800 leading-relaxed">
            Our AI spatial & semantic model (SBERT + Haversine) detected an active civic issue reported ~
            <strong>{duplicate.distanceMeters || 45} meters</strong> away from your marked location.
          </p>
        </div>
      </div>

      {/* Existing Complaint Summary Box */}
      {existing && (
        <div className="bg-white/90 backdrop-blur-xs border border-amber-200 rounded-2xl p-4 space-y-2.5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-xs bg-slate-900 text-white px-2 py-0.5 rounded">
                {existing.id}
              </span>
              <span className="text-xs font-bold text-slate-800">{existing.category}</span>
            </div>
            <div className="flex items-center gap-2">
              <PriorityBadge priority={existing.priority} size="sm" />
              <StatusBadge status={existing.status} size="sm" />
            </div>
          </div>

          <p className="text-xs text-slate-700 leading-relaxed line-clamp-2 italic">
            "{existing.description}"
          </p>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-1">
            <div className="flex items-center gap-1 text-slate-600">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>{existing.location.address}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Reported {new Date(existing.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Citizen Action Selection */}
      <div className="space-y-2 pt-1">
        <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
          What would you like to do?
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Option 1: View Existing */}
          <button
            type="button"
            onClick={() => {
              onSelectAction('view');
              if (existing?.id) {
                window.open(`/track?id=${existing.id}`, '_blank');
              }
            }}
            className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between gap-2 ${
              selectedAction === 'view'
                ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                : 'bg-white hover:bg-amber-100/50 border-amber-200 text-slate-800'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-bold flex items-center gap-1.5">
                <ExternalLink className="w-3.5 h-3.5" />
                View Existing
              </span>
            </div>
            <p className={`text-[10px] leading-tight ${selectedAction === 'view' ? 'text-amber-100' : 'text-slate-500'}`}>
              Inspect progress timeline & officer remarks in a new tab.
            </p>
          </button>

          {/* Option 2: Add My Report / Upvote (Recommended) */}
          <button
            type="button"
            onClick={() => onSelectAction('upvote')}
            className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between gap-2 relative ${
              selectedAction === 'upvote'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-400'
                : 'bg-white hover:bg-emerald-50 border-emerald-200 text-slate-800'
            }`}
          >
            <span className="absolute -top-2 right-2 text-[9px] font-bold bg-emerald-600 text-white px-1.5 py-0.2 rounded-full uppercase shadow-xs">
              Recommended
            </span>
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-bold flex items-center gap-1.5">
                <PlusCircle className="w-3.5 h-3.5 text-emerald-500" />
                Add My Report
              </span>
            </div>
            <p className={`text-[10px] leading-tight ${selectedAction === 'upvote' ? 'text-emerald-100' : 'text-slate-500'}`}>
              Attach your photo/voice to escalate priority and receive updates.
            </p>
          </button>

          {/* Option 3: Submit as New Complaint */}
          <button
            type="button"
            onClick={() => onSelectAction('submit_new')}
            className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between gap-2 ${
              selectedAction === 'submit_new'
                ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                : 'bg-white hover:bg-sky-50 border-sky-200 text-slate-800'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-bold flex items-center gap-1.5">
                <FilePlus2 className="w-3.5 h-3.5 text-sky-500" />
                Submit as New
              </span>
            </div>
            <p className={`text-[10px] leading-tight ${selectedAction === 'submit_new' ? 'text-sky-100' : 'text-slate-500'}`}>
              Create a distinct separate ticket if this is an independent issue.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
};
