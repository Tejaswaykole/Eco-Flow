import React from 'react';
import { cn } from '../../lib/utils';
import { ECOPriority, ECOStatus } from '../../types';

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
}

export function StatusBadge({ status, className }: { status: ECOStatus | string | undefined | null; className?: string }) {
  const normalized = status ? String(status) : 'UNKNOWN';

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
      case 'ARCHIVED':
        return 'bg-slate-200 text-slate-800 border-slate-300';
      case 'REJECTED':
      case 'CANCELLED':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'CHANGES_REQUESTED':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'NEEDS_INFORMATION':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'ACCEPTED':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'PROMOTED':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'ISSUED':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'COMPLETED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'ACKNOWLEDGED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold';
      case 'PENDING':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border tracking-wide uppercase',
        getColors(normalized),
        className
      )}
    >
      {normalized.replace(/_/g, ' ')}
    </span>
  );
}

export function PriorityBadge({ priority, className }: { priority: ECOPriority | string | undefined | null; className?: string }) {
  const normalized = priority ? String(priority) : 'MEDIUM';

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
        getColors(normalized),
        className
      )}
    >
      {normalized}
    </span>
  );
}

export function RequestTypeBadge({ type, className }: { type: string | undefined | null; className?: string }) {
  const normalized = type ? String(type) : 'OTHER';

  const getColors = (t: string) => {
    switch (t.toUpperCase()) {
      case 'DEFECT':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'IMPROVEMENT':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'COST_REDUCTION':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'SAFETY':
        return 'bg-amber-50 text-amber-800 border-amber-200 font-semibold';
      case 'OTHER':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border uppercase tracking-wider',
        getColors(normalized),
        className
      )}
    >
      {normalized.replace(/_/g, ' ')}
    </span>
  );
}

export function DepartmentBadge({ department, className }: { department: string | undefined | null; className?: string }) {
  const normalized = department ? String(department) : 'ENGINEERING';

  const getColors = (d: string) => {
    switch (d.toUpperCase()) {
      case 'ENGINEERING':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'QUALITY':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'PRODUCTION':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'PROCUREMENT':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      case 'INVENTORY':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'MANAGEMENT':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border uppercase tracking-wider',
        getColors(normalized),
        className
      )}
    >
      {normalized.replace(/_/g, ' ')}
    </span>
  );
}

export function DispositionTypeBadge({ type, className }: { type: string | undefined | null; className?: string }) {
  const normalized = type ? String(type) : 'SCRAP';

  const getColors = (t: string) => {
    switch (t.toUpperCase()) {
      case 'SCRAP':
        return 'bg-rose-100 text-rose-800 border-rose-300 font-bold';
      case 'REWORK':
        return 'bg-amber-50 text-amber-800 border-amber-200 font-semibold';
      case 'USE_AS_IS':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border uppercase tracking-wider',
        getColors(normalized),
        className
      )}
    >
      {normalized.replace(/_/g, ' ')}
    </span>
  );
}
