import React, { useState } from 'react';
import type { KnowledgeGuidance } from '../../types';
import {
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Shield,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Info,
} from 'lucide-react';

interface KnowledgeGuidanceCardProps {
  guidance: KnowledgeGuidance | null;
  isLoading?: boolean;
  onRefresh?: () => void;
  title?: string;
}

export const KnowledgeGuidanceCard: React.FC<KnowledgeGuidanceCardProps> = ({
  guidance,
  isLoading = false,
  onRefresh,
  title = 'Municipal SOP & Knowledge Support',
}) => {
  const [showAllRefs, setShowAllRefs] = useState(false);

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-4 bg-slate-200 rounded-md w-1/3"></div>
          <div className="h-4 bg-slate-200 rounded-full w-24"></div>
        </div>
        <div className="h-12 bg-slate-100 rounded-xl"></div>
        <div className="space-y-2">
          <div className="h-3 bg-slate-200 rounded w-5/6"></div>
          <div className="h-3 bg-slate-200 rounded w-4/6"></div>
        </div>
      </div>
    );
  }

  if (!guidance || !guidance.found) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-700 font-bold text-sm">
            <BookOpen className="w-4 h-4 text-slate-500" />
            <span>{title}</span>
          </div>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          )}
        </div>
        <div className="p-3.5 bg-white border border-slate-200 rounded-xl flex items-start gap-3">
          <Info className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-800">
              No relevant knowledge source was found for this complaint.
            </p>
            <p className="text-[11px] text-slate-500">
              No matching municipal standard operating procedure or approved guideline was identified for this specific issue. Standard departmental protocol applies.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isOfficial = guidance.isOfficialInstruction;
  const references = guidance.references || [];
  const displayRefs = showAllRefs ? references : references.slice(0, 2);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-0">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-xl ${isOfficial ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'}`}>
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">{title}</h3>
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  isOfficial
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                }`}
              >
                {isOfficial ? 'Official Municipal SOP' : 'General Resolution Guidance'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Grounded in approved departmental procedures and municipal resolution standards
            </p>
          </div>
        </div>

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="p-1.5 hover:bg-slate-200/60 text-slate-500 rounded-lg transition"
            title="Refresh Knowledge"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {/* Grounded Summary */}
        <div className="p-3.5 bg-blue-50/50 border border-blue-200/70 rounded-xl space-y-1">
          <div className="flex items-center gap-1.5 text-blue-900 font-bold text-xs uppercase tracking-wider">
            <Shield className="w-3.5 h-3.5 text-blue-600" />
            <span>Procedural Overview</span>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed font-medium">
            {guidance.summary}
          </p>
        </div>

        {/* Recommended Actions */}
        {guidance.recommendedActions && guidance.recommendedActions.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Recommended Standard Actions</span>
            </h4>
            <div className="grid grid-cols-1 gap-1.5">
              {guidance.recommendedActions.map((action, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-100 text-xs text-slate-700 transition"
                >
                  <span className="font-bold text-emerald-600 mt-0.5">•</span>
                  <span>{action}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Safety Precautions & Mandatory Protocols */}
        {guidance.precautions && guidance.precautions.length > 0 && (
          <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl space-y-2">
            <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>Mandatory Safety & Precautions</span>
            </h4>
            <ul className="space-y-1 text-xs text-amber-800">
              {guidance.precautions.map((precaution, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="font-bold text-amber-600 mt-0.5">⚠</span>
                  <span>{precaution}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Supporting References & Citations */}
        {references.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Grounded Knowledge Sources ({references.length})
              </span>
              {references.length > 2 && (
                <button
                  type="button"
                  onClick={() => setShowAllRefs(!showAllRefs)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 transition"
                >
                  <span>{showAllRefs ? 'Show Fewer' : `View All (${references.length})`}</span>
                  {showAllRefs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              {displayRefs.map((ref, idx) => (
                <div
                  key={idx}
                  className="p-2.5 bg-slate-50/70 border border-slate-200/70 rounded-xl flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-slate-500" />
                      <span className="font-bold text-slate-900">{ref.title}</span>
                      {ref.version && (
                        <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-mono">
                          v{ref.version}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {ref.source} • <span className="font-medium text-slate-700">{ref.department}</span>
                      {ref.sectionHeading && ` • ${ref.sectionHeading}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full block">
                      Score: {Math.round(ref.relevanceScore * 100)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Advisory Assistance Disclaimer Footer */}
      <div className="p-3 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-2">
        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span>
          <strong>Operational Assistance Notice:</strong> Grounded guidance provides reference procedures. Field officers are responsible for actual on-site technical decisions and resolution execution.
        </span>
      </div>
    </div>
  );
};
