import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { Complaint } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { PriorityBadge } from '../common/PriorityBadge';
import { CategoryIcon } from '../common/CategoryIcon';
import { MapPin, Calendar, ArrowRight, Volume2, Image as ImageIcon } from 'lucide-react';

interface ComplaintCardProps {
  complaint: Complaint;
  compact?: boolean;
}

export const ComplaintCard: React.FC<ComplaintCardProps> = ({
  complaint,
  compact = false
}) => {
  const navigate = useNavigate();

  const handleTrackClick = () => {
    navigate(`/track?id=${complaint.id}`);
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between gap-4 group">
      {/* Top Header: ID, Category & Priority */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-50 text-sky-600 rounded-xl border border-sky-100 group-hover:scale-105 transition">
              <CategoryIcon category={complaint.category} className="w-5 h-5" />
            </div>
            <div>
              <span className="font-mono font-bold text-xs text-slate-900 block">
                {complaint.id}
              </span>
              <span className="text-xs font-bold text-slate-700">
                {complaint.category}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <PriorityBadge priority={complaint.priority} size="sm" />
            <StatusBadge status={complaint.status} size="sm" />
          </div>
        </div>

        {/* Problem Statement Snippet */}
        <p className={`text-xs text-slate-600 leading-relaxed ${compact ? 'line-clamp-2' : 'line-clamp-3'}`}>
          "{complaint.description}"
        </p>
      </div>

      {/* Meta Bar: Location, Date, Media Chips, and Track CTA */}
      <div className="pt-3 border-t border-slate-100 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
          <div className="flex items-center gap-1 text-slate-600 max-w-[200px] truncate">
            <MapPin className="w-3.5 h-3.5 text-sky-600 flex-shrink-0" />
            <span className="truncate">{complaint.location.landmark || complaint.location.address}</span>
          </div>

          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{formatDate(complaint.createdAt)}</span>
          </div>
        </div>

        {/* Media indicators & Track Button */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            {complaint.voiceUrl && (
              <span className="flex items-center gap-0.5 text-rose-600 font-medium" title="Voice note attached">
                <Volume2 className="w-3.5 h-3.5" />
                <span>Voice</span>
              </span>
            )}
            {complaint.imageUrls && complaint.imageUrls.length > 0 && (
              <span className="flex items-center gap-0.5 text-sky-600 font-medium" title="Photo evidence attached">
                <ImageIcon className="w-3.5 h-3.5" />
                <span>{complaint.imageUrls.length} Photo{complaint.imageUrls.length > 1 ? 's' : ''}</span>
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleTrackClick}
            className="px-3.5 py-1.5 bg-sky-50 hover:bg-sky-600 text-sky-700 hover:text-white text-xs font-bold rounded-xl transition flex items-center gap-1 group/btn"
          >
            <span>Track Complaint</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition" />
          </button>
        </div>
      </div>
    </div>
  );
};
