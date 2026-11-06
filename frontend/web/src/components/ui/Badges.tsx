import React from 'react';
import { cn } from '../../lib/utils';
import { ECOPriority, ECOStatus } from '../../types';

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
}

export function StatusBadge({ status, className }: { status: ECOStatus | string; className?: string }) {
  const getColors = (st: string) => {
    switch (st.toUpperCase()) {
      case 'DRAFT':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'SUBMITTED':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'UNDER_REVIEW':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'APPROVED':
      case 'RELEASED':
      case 'ACTIVE':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'REJECTED':
      case 'CANCELLED':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'CHANGES_REQUESTED':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border tracking-wide uppercase',
        getColors(status),
        className
      )}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function PriorityBadge({ priority, className }: { priority: ECOPriority | string; className?: string }) {
  const getColors = (p: string) => {
    switch (p.toUpperCase()) {
      case 'LOW':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'MEDIUM':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'HIGH':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'CRITICAL':
        return 'bg-rose-100 text-rose-800 border-rose-300 font-bold';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border uppercase tracking-wider',
        getColors(priority),
        className
      )}
    >
      {priority}
    </span>
  );
}
