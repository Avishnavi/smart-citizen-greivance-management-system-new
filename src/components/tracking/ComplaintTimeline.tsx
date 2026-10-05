import React from 'react';
import type { TimelineEvent } from '../../types';
import {
  Clock,
  Circle,
  User,
  MessageSquare,
  Check
} from 'lucide-react';

interface ComplaintTimelineProps {
  timeline: TimelineEvent[];
  onAddFeedbackClick?: () => void;
  hasFeedback?: boolean;
}

export const ComplaintTimeline: React.FC<ComplaintTimelineProps> = ({
  timeline,
  onAddFeedbackClick,
  hasFeedback
}) => {
  const getStepIcon = (completed: boolean, current: boolean) => {
    if (current) {
      return <Clock className="w-4 h-4 text-white animate-spin" />;
    }
    if (completed) {
      return <Check className="w-4 h-4 text-white stroke-[3]" />;
    }
    return <Circle className="w-3.5 h-3.5 text-slate-300 fill-current" />;
  };

  const formatTimestamp = (timestamp: string) => {
    if (!timestamp || timestamp === 'Pending') return 'Pending';
    try {
      const date = new Date(timestamp);
      return (
        date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) +
        ' • ' +
        date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
    } catch {
      return timestamp;
    }
  };

  const visibleTimeline = (timeline || []).filter((item) => {
    const t = (item.title || '').toLowerCase();
    const d = (item.description || '').toLowerCase();
    const isAi =
      /\b(ai|llm)\b/i.test(t) ||
      /\b(ai|llm)\b/i.test(d) ||
      t.includes('ai processing') ||
      t.includes('ai analysis') ||
      t.includes('ai classification') ||
      t.includes('ai verification') ||
      t.includes('ai scoring') ||
      t.includes('ai categorization') ||
      t.includes('ai prediction') ||
      d.includes('ai pipeline') ||
      d.includes('llm analysis') ||
      d.includes('ai analysis');
    return !isAi;
  });

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
            Grievance Resolution Lifecycle
          </h3>
          <p className="text-xs text-slate-500">
            Real-time municipal workflow and field crew status updates
          </p>
        </div>
        <span className="px-2.5 py-1 text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200 rounded-lg">
          Live SLA SLA-2026
        </span>
      </div>

      {visibleTimeline.length === 0 ? (
        <div className="py-8 text-center text-slate-400 text-xs">
          No workflow timeline events recorded yet.
        </div>
      ) : (
        <div className="relative pl-6 space-y-6 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
          {visibleTimeline.map((item, idx) => {
            const isFeedbackStep = item.step === 6;

            return (
              <div key={item.id || idx} className="relative group">
                <div
                  className={`absolute -left-6 top-0.5 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                    item.current
                      ? 'bg-sky-600 shadow-md shadow-sky-600/30 ring-4 ring-sky-100 animate-priority-pulse'
                      : item.completed
                      ? 'bg-emerald-600 shadow-sm shadow-emerald-600/30 ring-4 ring-emerald-50'
                      : 'bg-white border-2 border-slate-200'
                  }`}
                >
                  {getStepIcon(item.completed, item.current)}
                </div>

              <div
                className={`p-4 rounded-2xl border transition ${
                  item.current
                    ? 'bg-sky-50/60 border-sky-200 shadow-xs'
                    : item.completed
                    ? 'bg-slate-50/70 border-slate-200/80'
                    : 'bg-white border-slate-100 opacity-60'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800">
                      Step {item.step}: {item.title}
                    </span>
                    {item.current && (
                      <span className="px-2 py-0.5 text-[10px] font-extrabold bg-sky-600 text-white rounded-full uppercase tracking-wider">
                        Active Stage
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-slate-500">
                    {formatTimestamp(item.timestamp)}
                  </span>
                </div>

                <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                  {item.description}
                </p>

                {item.officerName && (
                  <div className="mt-2.5 flex items-center gap-2 text-xs text-slate-700 bg-white/80 px-3 py-1.5 rounded-xl border border-slate-200/60 w-fit">
                    <User className="w-3.5 h-3.5 text-sky-600" />
                    <span className="font-semibold">{item.officerName}</span>
                    {item.department && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span className="text-slate-500 text-[11px]">{item.department}</span>
                      </>
                    )}
                  </div>
                )}

                {isFeedbackStep && !hasFeedback && onAddFeedbackClick && (
                  <div className="mt-3 pt-2 border-t border-slate-200/60">
                    <button
                      type="button"
                      onClick={onAddFeedbackClick}
                      className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>★ Rate & Submit Citizen Feedback</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        </div>
      )}
    </div>
  );
};
