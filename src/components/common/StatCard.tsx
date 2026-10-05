import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  count: number;
  icon: LucideIcon;
  colorScheme: 'slate' | 'amber' | 'sky' | 'emerald';
  subtitle?: string;
  onClick?: () => void;
  active?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  count,
  icon: Icon,
  colorScheme,
  subtitle,
  onClick,
  active = false
}) => {
  const schemeClasses = {
    slate: {
      card: 'bg-white/90 border-slate-200/80 hover:border-slate-300 hover:shadow-md hover:bg-slate-50/50',
      activeCard: 'border-slate-800 ring-2 ring-slate-800/10 shadow-md bg-slate-50/80',
      iconBox: 'bg-slate-100/80 text-slate-700 border border-slate-200/60',
      countText: 'text-slate-900',
      accentGlow: 'bg-slate-500/5'
    },
    amber: {
      card: 'bg-white/90 border-amber-200/60 hover:border-amber-300 hover:shadow-md hover:shadow-amber-500/5',
      activeCard: 'border-amber-500 ring-2 ring-amber-500/20 shadow-md bg-amber-50/40',
      iconBox: 'bg-amber-50 text-amber-600 border border-amber-200/60',
      countText: 'text-amber-700',
      accentGlow: 'bg-amber-500/5'
    },
    sky: {
      card: 'bg-white/90 border-sky-200/60 hover:border-sky-300 hover:shadow-md hover:shadow-sky-500/5',
      activeCard: 'border-sky-500 ring-2 ring-sky-500/20 shadow-md bg-sky-50/40',
      iconBox: 'bg-sky-50 text-sky-600 border border-sky-200/60',
      countText: 'text-sky-700',
      accentGlow: 'bg-sky-500/5'
    },
    emerald: {
      card: 'bg-white/90 border-emerald-200/60 hover:border-emerald-300 hover:shadow-md hover:shadow-emerald-500/5',
      activeCard: 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-md bg-emerald-50/40',
      iconBox: 'bg-emerald-50 text-emerald-600 border border-emerald-200/60',
      countText: 'text-emerald-700',
      accentGlow: 'bg-emerald-500/5'
    }
  };

  const scheme = schemeClasses[colorScheme];

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden p-4 md:p-5 rounded-3xl border transition-all duration-300 backdrop-blur-xs ${
        onClick ? 'cursor-pointer hover:-translate-y-1' : ''
      } ${active ? scheme.activeCard : scheme.card} shadow-xs`}
    >
      {/* Subtle background ambient tint */}
      <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl pointer-events-none ${scheme.accentGlow}`} />

      <div className="flex items-center justify-between relative z-10">
        <span className="text-xs font-bold text-slate-500 tracking-tight">
          {title}
        </span>
        <div className={`p-2.5 rounded-2xl ${scheme.iconBox} shadow-2xs`}>
          <Icon className="w-4 h-4 md:w-4.5 md:h-4.5" />
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-2 relative z-10">
        <span className={`text-2xl md:text-3xl font-black tracking-tight ${scheme.countText}`}>
          {count}
        </span>
        {subtitle && (
          <span className="text-[11px] text-slate-400 font-medium truncate">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
};
