import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import type { Complaint } from '../../types';
import {
  CheckCircle2,
  Search,
  Home,
  Copy
} from 'lucide-react';
import { PriorityBadge } from '../common/PriorityBadge';
import { CategoryIcon } from '../common/CategoryIcon';

interface Step5SuccessProps {
  complaint: Complaint;
  onReset: () => void;
}

export const Step5Success: React.FC<Step5SuccessProps> = ({ complaint, onReset }) => {
  const navigate = useNavigate();

  useEffect(() => {
    try {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 }
      });
    } catch {
      // ignore
    }
  }, []);

  const [copied, setCopied] = React.useState(false);

  const copyId = () => {
    navigator.clipboard.writeText(complaint.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-md text-center max-w-2xl mx-auto space-y-6 animate-in zoom-in-95 duration-200">
      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
        <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12" />
      </div>

      <div className="space-y-1.5">
        <span className="px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-full text-xs font-bold uppercase tracking-wider">
          Official Submission Received
        </span>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Complaint Submitted Successfully
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
          Your grievance has been forwarded to the concerned municipal department with automated AI SLA tracking.
        </p>
      </div>

      <div className="p-5 bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl text-white shadow-xl space-y-3">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">
          Official Complaint Tracking ID
        </span>
        <div className="flex items-center justify-center gap-3">
          <span className="text-2xl sm:text-3xl font-mono font-extrabold text-sky-400 tracking-wider">
            {complaint.id}
          </span>
          <button
            type="button"
            onClick={copyId}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition text-white/80 hover:text-white"
            title="Copy Complaint ID"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
        {copied && (
          <p className="text-[11px] text-emerald-400 font-semibold animate-in fade-in">
            ✓ Copied to clipboard!
          </p>
        )}
      </div>

      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div>
          <span className="text-slate-400 font-medium block">Category:</span>
          <div className="flex items-center gap-1.5 mt-0.5 font-bold text-slate-800">
            <CategoryIcon category={complaint.category} className="w-4 h-4" />
            <span>{complaint.category}</span>
          </div>
        </div>

        <div>
          <span className="text-slate-400 font-medium block">Responsible Department:</span>
          <span className="font-bold text-slate-800 block mt-0.5">{complaint.department}</span>
        </div>

        <div>
          <span className="text-slate-400 font-medium block">Location:</span>
          <span className="font-bold text-slate-800 block mt-0.5 truncate">{complaint.location.address}</span>
        </div>

        <div>
          <span className="text-slate-400 font-medium block">Assigned Priority:</span>
          <div className="mt-0.5">
            <PriorityBadge priority={complaint.priority} size="sm" />
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <button
          type="button"
          onClick={() => {
            onReset();
            navigate(`/track?id=${complaint.id}`);
          }}
          className="w-full sm:w-auto px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs sm:text-sm rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-sky-600/20 transition hover:scale-[1.02] active:scale-98"
        >
          <Search className="w-4 h-4" />
          <span>Track Complaint Status</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onReset();
            navigate('/');
          }}
          className="w-full sm:w-auto px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm rounded-2xl flex items-center justify-center gap-2 transition"
        >
          <Home className="w-4 h-4" />
          <span>Go to Citizen Home</span>
        </button>
      </div>
    </div>
  );
};
