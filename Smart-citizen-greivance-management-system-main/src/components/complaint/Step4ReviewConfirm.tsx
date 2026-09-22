import React from 'react';
import { useComplaints } from '../../context/ComplaintContext';
import { PriorityBadge } from '../common/PriorityBadge';
import {
  Building,
  MapPin,
  Volume2,
  Image as ImageIcon,
  ShieldCheck,
  Edit,
  Send,
  RefreshCw
} from 'lucide-react';
import { CategoryIcon } from '../common/CategoryIcon';

interface Step4ReviewConfirmProps {
  onEdit: (stepIndex: number) => void;
  onSubmit: () => void;
}

export const Step4ReviewConfirm: React.FC<Step4ReviewConfirmProps> = ({
  onEdit,
  onSubmit
}) => {
  const { draft, isSubmitting } = useComplaints();
  const analysis = draft.aiAnalysis;

  const category =
    draft.selectedCategory || analysis?.classification.category || 'Pothole';
  const department =
    draft.selectedDepartment || analysis?.classification.department || 'Road Maintenance Department';
  const priority =
    draft.selectedPriority || analysis?.priority.priority || 'Medium';

  const hasVoice = Boolean(draft.voiceUrl || draft.voiceBlob);
  const imageCount = draft.imageUrls.length;

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-xs font-bold bg-sky-100 text-sky-800 rounded-lg">
              Step 4 of 4
            </span>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Review Your Complaint
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Please verify all grievance details before submitting to the Smart City portal.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onEdit(1)}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-xl transition self-start md:self-auto"
        >
          <Edit className="w-3.5 h-3.5" />
          <span>Edit Details</span>
        </button>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Category
            </span>
            <div className="flex items-center gap-2.5 pt-0.5">
              <CategoryIcon category={category} className="w-5 h-5" />
              <span className="text-sm font-extrabold text-slate-900">{category}</span>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Priority
            </span>
            <div className="pt-0.5">
              <PriorityBadge priority={priority} size="md" />
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Responsible Department
          </span>
          <div className="flex items-center gap-2 pt-0.5">
            <Building className="w-4 h-4 text-slate-600" />
            <span className="text-sm font-bold text-slate-800">{department}</span>
          </div>
        </div>

        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Location
            </span>
            <button
              onClick={() => onEdit(2)}
              className="text-[11px] text-sky-600 hover:text-sky-700 font-semibold"
            >
              Change
            </button>
          </div>
          <div className="flex items-start gap-2 pt-0.5">
            <MapPin className="w-4 h-4 text-sky-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs md:text-sm font-bold text-slate-800">
                {draft.location.address}
              </p>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                {draft.location.ward} • {draft.location.zone} ({draft.location.latitude.toFixed(4)}, {draft.location.longitude.toFixed(4)})
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Description
            </span>
            <button
              onClick={() => onEdit(1)}
              className="text-[11px] text-sky-600 hover:text-sky-700 font-semibold"
            >
              Edit
            </button>
          </div>
          <p className="text-xs md:text-sm text-slate-800 leading-relaxed italic bg-white p-3 rounded-xl border border-slate-200/80">
            "{draft.description || 'Civic issue reported with multimedia attachments.'}"
          </p>
        </div>

        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Attachments
          </span>
          <div className="flex flex-wrap items-center gap-3 pt-0.5 text-xs">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-medium text-slate-700">
              <ImageIcon className="w-4 h-4 text-sky-600" />
              <span>{imageCount} {imageCount === 1 ? 'Image' : 'Images'}</span>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-medium text-slate-700">
              <Volume2 className="w-4 h-4 text-rose-600" />
              <span>{hasVoice ? '1 Voice recording attached' : 'No voice recording'}</span>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-medium text-slate-700">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>
                {analysis?.duplicate.isDuplicate
                  ? 'Possible duplicate acknowledged'
                  : 'No duplicate found'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onEdit(1)}
          className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs md:text-sm rounded-2xl flex items-center justify-center gap-2 transition"
        >
          <Edit className="w-4 h-4" />
          <span>Edit</span>
        </button>

        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting}
          className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs md:text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition hover:scale-[1.01] active:scale-98 disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Submitting to Municipal Server...</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>Confirm & Submit</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
