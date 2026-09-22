import React from 'react';
import type { ComplaintPriority } from '../../types';
import { AlertTriangle, AlertCircle, ShieldAlert } from 'lucide-react';

interface PriorityBadgeProps {
  priority: ComplaintPriority;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({
  priority,
  size = 'md',
  showIcon = true
}) => {
  const getStyle = () => {
    switch (priority) {
      case 'High':
        return {
          bg: 'bg-rose-50 border-rose-200 text-rose-800',
          dot: 'bg-rose-500',
          pulse: true,
          icon: ShieldAlert
        };
      case 'Medium':
        return {
          bg: 'bg-amber-50 border-amber-200 text-amber-800',
          dot: 'bg-amber-500',
          pulse: false,
          icon: AlertTriangle
        };
      case 'Low':
      default:
        return {
          bg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
          dot: 'bg-emerald-500',
          pulse: false,
          icon: AlertCircle
        };
    }
  };

  const style = getStyle();
  const IconComponent = style.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 font-medium gap-1.5',
    lg: 'text-sm px-3 py-1.5 font-semibold gap-2'
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border ${style.bg} ${sizeClasses[size]} tracking-tight`}
    >
      <span className="relative flex h-2 w-2">
        {style.pulse && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${style.dot}`}></span>
      </span>
      {showIcon && (
        <IconComponent
          className={size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5'}
        />
      )}
      <span>{priority} Priority</span>
    </span>
  );
};
