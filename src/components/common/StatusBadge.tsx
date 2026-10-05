import React from 'react';
import type { ComplaintStatus } from '../../types';
import { Clock, CheckCircle2, RefreshCw, AlertCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: ComplaintStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showIcon = true
}) => {
  const getStyle = () => {
    switch (status) {
      case 'Pending':
        return {
          bg: 'bg-amber-50 border-amber-200 text-amber-800',
          dot: 'bg-amber-500',
          icon: Clock
        };
      case 'In Progress':
        return {
          bg: 'bg-sky-50 border-sky-200 text-sky-800',
          dot: 'bg-sky-500',
          icon: RefreshCw
        };
      case 'Resolved':
        return {
          bg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
          dot: 'bg-emerald-500',
          icon: CheckCircle2
        };
      case 'Rejected':
      default:
        return {
          bg: 'bg-slate-100 border-slate-200 text-slate-700',
          dot: 'bg-slate-400',
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
      className={`inline-flex items-center rounded-full border ${style.bg} ${sizeClasses[size]} tracking-tight transition-all`}
    >
      {showIcon && (
        <IconComponent
          className={`${size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5'} ${
            status === 'In Progress' ? 'animate-spin' : ''
          }`}
        />
      )}
      <span>{status}</span>
    </span>
  );
};
