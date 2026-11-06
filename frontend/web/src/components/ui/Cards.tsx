import React from 'react';
import { cn } from '../../lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  trend?: string;
  className?: string;
}

export function StatCard({ title, value, description, icon: Icon, trend, className }: StatCardProps) {
  return (
    <div className={cn('bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between', className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</span>
        {Icon && (
          <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg text-primary">
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
      <div className="mt-4">
        <div className="text-2xl font-bold tracking-tight text-slate-900">{value}</div>
        {(description || trend) && (
          <div className="mt-1 flex items-center text-xs text-slate-500 gap-1.5">
            {trend && <span className="text-emerald-600 font-semibold">{trend}</span>}
            {description && <span>{description}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 mb-6 border-b border-slate-200 gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
      {Icon && <Icon className="mx-auto h-10 w-10 text-slate-400 mb-3" />}
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {description && <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
