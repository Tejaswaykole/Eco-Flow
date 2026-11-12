import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApprovalsWorkflowService } from '../../services';
import { useAuth } from '../../context/AuthContext';
import { PendingApprovalItem, ApprovalStats } from '../../types';
import { PageHeader, StatCard, EmptyState } from '../../components/ui/Cards';
import { PriorityBadge, StatusBadge } from '../../components/ui/Badges';
import { Button } from '../../components/ui/Button';
import {
  CheckSquare,
  AlertTriangle,
  Clock,
  ArrowRight,
  Send,
  GitPullRequest,
  ClipboardList,
  Bell,
  ShoppingCart,
  ShieldAlert,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDate } from '../../lib/utils';

export function ApprovalsWorkspace() {
  const queryClient = useQueryClient();
  const { hasRole, hasPermission } = useAuth();
  const [activeDomain, setActiveDomain] = useState<string>('ALL');
  const [overdueOnly, setOverdueOnly] = useState<boolean>(false);
  const [reminderMessage, setReminderMessage] = useState<string | null>(null);

  const canSendReminders = hasRole('ADMINISTRATOR') || hasPermission('approvals:remind') || hasRole('LEAD_ENGINEER');

  const { data: approvalsData, isLoading } = useQuery({
    queryKey: ['approvals', activeDomain, overdueOnly],
    queryFn: () => ApprovalsWorkflowService.listPending(activeDomain === 'ALL' ? undefined : activeDomain, overdueOnly),
  });

  const { data: statsData } = useQuery<ApprovalStats>({
    queryKey: ['approvals', 'stats'],
    queryFn: () => ApprovalsWorkflowService.getStats(),
  });

  const reminderMutation = useMutation({
    mutationFn: () => ApprovalsWorkflowService.sendReminders(),
    onSuccess: (data) => {
      setReminderMessage(`Successfully sent ${data.remindersSent} overdue reminder notification(s).`);
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      setTimeout(() => setReminderMessage(null), 5000);
    },
  });

  const items: PendingApprovalItem[] = approvalsData?.data || [];
  const overdueCount = approvalsData?.pagination?.overdueCount || 0;

  const domainTabs = [
    { key: 'ALL', label: 'All Reviews', icon: CheckSquare },
    { key: 'ECO', label: 'Change Orders (ECO)', icon: GitPullRequest, count: statsData?.byDomain?.eco?.pending },
    { key: 'ECR', label: 'Change Requests (ECR)', icon: ClipboardList, count: statsData?.byDomain?.ecr?.pending },
    { key: 'ECN', label: 'Distribution (ECN)', icon: Bell, count: statsData?.byDomain?.ecn?.pending },
    { key: 'PURCHASE_ORDER', label: 'Purchase Orders', icon: ShoppingCart, count: statsData?.byDomain?.po?.pending },
    { key: 'NCR', label: 'Quality NCRs', icon: ShieldAlert, count: statsData?.byDomain?.ncr?.pending },
  ];

  const getDomainBadge = (type: string) => {
    switch (type) {
      case 'ECO':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">ECO</span>;
      case 'ECR':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">ECR</span>;
      case 'ECN':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">ECN</span>;
      case 'PURCHASE_ORDER':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">PO</span>;
      case 'NCR':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">NCR</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">{type}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approvals & Workflow Queue"
        description="Unified lifecycle signoff workspace across engineering, change management, purchasing, and quality."
        actions={
          canSendReminders ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => reminderMutation.mutate()}
              disabled={reminderMutation.isPending}
              className="gap-2"
            >
              <Send className="w-4 h-4" />
              <span>{reminderMutation.isPending ? 'Sending...' : 'Send Overdue Reminders'}</span>
            </Button>
          ) : undefined
        }
      />

      {reminderMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{reminderMessage}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Total Pending Signoffs"
          value={statsData?.totalPending ?? '...'}
          description="Items awaiting reviewer decision"
          icon={Clock}
        />
        <StatCard
          title="Overdue Approvals"
          value={statsData?.totalOverdue ?? '...'}
          description="Exceeded review SLA target"
          icon={AlertTriangle}
        />
        <StatCard
          title="Pending ECO Revisions"
          value={statsData?.byDomain?.eco?.pending ?? '...'}
          description="Formal engineering changes"
          icon={GitPullRequest}
        />
        <StatCard
          title="Open NCR Dispositions"
          value={statsData?.byDomain?.ncr?.pending ?? '...'}
          description="Quality reviews required"
          icon={ShieldAlert}
        />
      </div>

      {/* Navigation Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          {domainTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveDomain(tab.key)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 ${
                activeDomain === tab.key
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && tab.count > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    activeDomain === tab.key ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <button
          onClick={() => setOverdueOnly(!overdueOnly)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 ${
            overdueOnly
              ? 'bg-rose-50 border-rose-300 text-rose-700'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
          <span>Overdue Only</span>
          {overdueCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-200 text-rose-900">
              {overdueCount}
            </span>
          )}
        </button>
      </div>

      {/* Approvals Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-slate-500">Loading pending signoff items...</div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            title={overdueOnly ? 'No overdue approvals!' : 'All clear! No pending approvals'}
            description={
              overdueOnly
                ? 'All pending review items are currently within their SLA target window.'
                : 'All change proposals, purchase orders, and quality dispositions have been processed.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Domain</th>
                  <th className="py-3 px-4">Reference #</th>
                  <th className="py-3 px-4">Title / Scope</th>
                  <th className="py-3 px-4">Priority / Severity</th>
                  <th className="py-3 px-4">Submitted By</th>
                  <th className="py-3 px-4">Assignee</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Review Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={`${item.entityType}-${item.id}`} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4">{getDomainBadge(item.entityType)}</td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{item.referenceNumber}</td>
                    <td className="py-3.5 px-4 font-medium text-slate-800 max-w-xs truncate">{item.title}</td>
                    <td className="py-3.5 px-4">
                      {item.priority ? <PriorityBadge priority={item.priority as any} /> : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {item.submittedBy?.name || 'System'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {item.assignedTo?.name || 'Unassigned'}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className={item.isOverdue ? 'text-rose-600 font-bold' : 'text-slate-600'}>
                          {formatDate(item.dueDate)}
                        </span>
                        {item.isOverdue && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-rose-100 text-rose-700">
                            OVERDUE
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <StatusBadge status={item.status as any} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        to={item.link}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors shadow-sm"
                      >
                        <span>Review</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
