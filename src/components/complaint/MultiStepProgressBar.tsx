import React from 'react';
import { FileText, MapPin, Sparkles, CheckSquare, CheckCircle2 } from 'lucide-react';

interface MultiStepProgressBarProps {
  currentStep: number; // 1 to 5
  onStepClick?: (step: number) => void;
}

export const MultiStepProgressBar: React.FC<MultiStepProgressBarProps> = ({
  currentStep,
  onStepClick
}) => {
  const steps = [
    { num: 1, label: 'Describe Issue', icon: FileText },
    { num: 2, label: 'Location & Map', icon: MapPin },
    { num: 3, label: 'AI Triage', icon: Sparkles },
    { num: 4, label: 'Review & Submit', icon: CheckSquare },
    { num: 5, label: 'Success', icon: CheckCircle2 }
  ];

  return (
    <div className="w-full bg-white/95 rounded-3xl border border-slate-200/80 p-4 md:p-6 shadow-xs mb-6 backdrop-blur-md">
      <div className="relative flex items-center justify-between">
        {/* Connecting progress line */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-slate-100 w-full z-0 rounded-full">
          <div
            className="h-full bg-gradient-to-r from-sky-500 to-indigo-600 rounded-full transition-all duration-300 shadow-xs"
            style={{
              width: `${((Math.min(currentStep, 5) - 1) / (steps.length - 1)) * 100}%`
            }}
          />
        </div>

        {steps.map((step) => {
          const Icon = step.icon;
          const isCompleted = step.num < currentStep;
          const isCurrent = step.num === currentStep;
          const isClickable = onStepClick && step.num < currentStep && currentStep < 5;

          return (
            <button
              key={step.num}
              type="button"
              disabled={!isClickable}
              onClick={() => isClickable && onStepClick(step.num)}
              className={`relative z-10 flex flex-col items-center group transition ${
                isClickable ? 'cursor-pointer' : 'cursor-default'
              }`}
            >
              <div
                className={`w-9 h-9 md:w-11 md:h-11 rounded-2xl flex items-center justify-center font-bold text-xs md:text-sm transition-all duration-300 ${
                  isCompleted
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                    : isCurrent
                    ? 'bg-gradient-to-tr from-sky-600 to-indigo-600 text-white ring-4 ring-sky-100 shadow-lg shadow-sky-600/30 scale-105'
                    : 'bg-white border border-slate-200 text-slate-400'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <Icon className="w-4 h-4 md:w-5 md:h-5" />
                )}
              </div>
              <span
                className={`mt-2 text-[11px] md:text-xs font-bold whitespace-nowrap transition-colors hidden sm:block ${
                  isCurrent
                    ? 'text-sky-700'
                    : isCompleted
                    ? 'text-slate-800'
                    : 'text-slate-400'
                }`}
              >
                {step.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Mobile Step indicator text */}
      <div className="sm:hidden mt-3 text-center text-xs font-bold text-sky-700 bg-sky-50 py-1.5 rounded-xl border border-sky-100">
        Step {currentStep} of 5: {steps[currentStep - 1]?.label}
      </div>
    </div>
  );
};
