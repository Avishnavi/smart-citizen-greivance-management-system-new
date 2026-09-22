import React, { useEffect, useState } from 'react';
import { useComplaints } from '../../context/ComplaintContext';
import { PriorityBadge } from '../common/PriorityBadge';
import { CategoryIcon } from '../common/CategoryIcon';
import { DuplicateAlertCard } from './DuplicateAlertCard';
import {
  Building,
  MapPin,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Cpu,
  CheckCircle2
} from 'lucide-react';

interface Step3AIAnalysisProps {
  onNext: () => void;
  onBack: () => void;
}

export const Step3AIAnalysis: React.FC<Step3AIAnalysisProps> = ({ onNext, onBack }) => {
  const {
    draft,
    isAnalyzing,
    analyzeDraftAI,
    updateDraft
  } = useComplaints();

  const [hasRun, setHasRun] = useState(false);

  useEffect(() => {
    if (!draft.aiAnalysis && !hasRun) {
      setHasRun(true);
      analyzeDraftAI();
    }
  }, [draft.aiAnalysis, hasRun, analyzeDraftAI]);

  const analysis = draft.aiAnalysis;

  if (isAnalyzing || !analysis) {
    return (
      <div className="bg-white rounded-3xl p-8 md:p-12 border border-slate-200 shadow-sm text-center space-y-6">
        <div className="relative inline-flex items-center justify-center">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-sky-600/30 animate-pulse">
            <Cpu className="w-10 h-10" />
          </div>
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-sky-500"></span>
          </span>
        </div>

        <div className="space-y-2 max-w-md mx-auto">
          <h3 className="text-lg md:text-xl font-extrabold text-slate-900 tracking-tight">
            Running Smart City AI Grievance Pipeline
          </h3>
          <p className="text-xs text-slate-500">
            Analyzing complaint semantic context, geospatial proximity, and emergency hazard index...
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto text-left text-xs pt-2">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2.5">
            <RefreshCw className="w-4 h-4 text-sky-600 animate-spin" />
            <div>
              <span className="font-bold text-slate-800 block">XLM-RoBERTa Model</span>
              <span className="text-[10px] text-slate-500">Grievance Category & Department</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2.5">
            <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin" />
            <div>
              <span className="font-bold text-slate-800 block">SBERT + Haversine</span>
              <span className="text-[10px] text-slate-500">Semantic & Spatial Duplicate Check</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2.5">
            <RefreshCw className="w-4 h-4 text-amber-600 animate-spin" />
            <div>
              <span className="font-bold text-slate-800 block">XGBoost Classifier</span>
              <span className="text-[10px] text-slate-500">Hazard SLA Priority Scoring</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2.5">
            <RefreshCw className="w-4 h-4 text-emerald-600 animate-spin" />
            <div>
              <span className="font-bold text-slate-800 block">Department Routing</span>
              <span className="text-[10px] text-slate-500">Ward Officer Queue Assignment</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { classification, priority, duplicate } = analysis;

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-xs font-bold bg-sky-100 text-sky-800 rounded-lg">
              Step 3 of 4
            </span>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              AI Complaint Analysis
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Automated intelligence results based on complaint description and geo-coordinates.
          </p>
        </div>

        <button
          type="button"
          onClick={() => analyzeDraftAI()}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Re-run Analysis</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Category (Blue Badge) */}
        <div className="p-4 bg-sky-50/60 border border-sky-100 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Category
            </span>
            <span className="text-[11px] text-sky-700 font-mono font-bold">
              {Math.round(classification.confidence * 100)}% Confidence
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white rounded-xl shadow-xs border border-sky-100">
              <CategoryIcon category={classification.category} className="w-6 h-6" />
            </div>
            <div>
              <span className="inline-flex items-center px-3 py-1 bg-sky-600 text-white rounded-full text-xs font-extrabold tracking-wide shadow-xs">
                {classification.category}
              </span>
              <p className="text-[11px] text-slate-500 mt-1">
                Detected via NLP semantic classifier
              </p>
            </div>
          </div>
        </div>

        {/* Card 2: Responsible Department (Neutral Badge) */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Responsible Department
          </span>

          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white rounded-xl shadow-xs border border-slate-200 text-slate-700">
              <Building className="w-6 h-6" />
            </div>
            <div>
              <span className="inline-flex items-center px-3 py-1 bg-slate-800 text-white rounded-full text-xs font-bold tracking-wide shadow-xs">
                {classification.department}
              </span>
              <p className="text-[11px] text-slate-500 mt-1">
                Allocated to {draft.location.ward || 'Ward 102'} Division
              </p>
            </div>
          </div>
        </div>

        {/* Card 3: Location Display */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Location
          </span>

          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-white rounded-xl shadow-xs border border-slate-200 text-slate-700 mt-0.5">
              <MapPin className="w-5 h-5 text-sky-600" />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-xs md:text-sm">
                {draft.location.address}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {draft.location.ward} • {draft.location.zone}
              </p>
            </div>
          </div>
        </div>

        {/* Card 4: Priority (Red/Yellow/Green Badge) */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Priority Assessment
            </span>
            <span className="text-[11px] font-mono font-bold text-slate-600">
              Score: {priority.score}/100
            </span>
          </div>

          <div className="flex items-center gap-3">
            <PriorityBadge priority={priority.priority} size="lg" />
          </div>

          {priority.factors && priority.factors.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {priority.factors.map((f, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 text-[10px] font-semibold bg-white border border-slate-200 rounded text-slate-600"
                >
                  ✓ {f}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Duplicate Check Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Spatial Duplicate Detection
          </span>
          {!duplicate.isDuplicate ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 border border-emerald-200 text-emerald-800">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>No similar complaint found</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
              ⚠️ Possible Duplicate Detected
            </span>
          )}
        </div>

        {duplicate.isDuplicate ? (
          <DuplicateAlertCard
            duplicate={duplicate}
            selectedAction={draft.duplicateResolution}
            onSelectAction={(act) => updateDraft({ duplicateResolution: act })}
          />
        ) : (
          <div className="p-4 bg-emerald-50/50 border border-emerald-200/80 rounded-2xl text-xs text-emerald-900 flex items-center gap-3">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold">Unique Grievance Verified</p>
              <p className="text-emerald-700 text-[11px] mt-0.5">
                No overlapping complaints detected within 400m radius of your selected coordinates.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs md:text-sm rounded-2xl flex items-center gap-2 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <button
          type="button"
          onClick={onNext}
          className="px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs md:text-sm rounded-2xl flex items-center gap-2 shadow-md shadow-sky-600/20 transition hover:scale-[1.01] active:scale-98"
        >
          <span>Next: Review & Confirm</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
