import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ECOService } from '../../services';
import { PageHeader, EmptyState } from '../../components/ui/Cards';
import { PriorityBadge, StatusBadge } from '../../components/ui/Badges';
import { CheckSquare, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDate } from '../../lib/utils';

export function ApprovalsWorkspace() {
  const { data: ecosData, isLoading } = useQuery({
    queryKey: ['ecos', 'approvals'],
    queryFn: () => ECOService.listECOs(1, 100),
  });

  const pendingApprovals = (ecosData?.data || []).filter(
    (eco) => eco.status === 'SUBMITTED' || eco.status === 'UNDER_REVIEW'
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approvals & Review Workspace"
        description="Formal signoff queue for engineering change proposals awaiting design authority verification."
      />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading pending signoff items...</div>
        ) : pendingApprovals.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            title="All clear! No pending approvals"
            description="All submitted ECO revisions have been reviewed and signed off."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">ECO #</th>
                  <th className="py-3 px-4">Title</th>
                  <th className="py-3 px-4">Target Product</th>
                  <th className="py-3 px-4 text-center">Revision</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Submitted</th>
                  <th className="py-3 px-4 text-right">Review Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingApprovals.map((eco) => (
                  <tr key={eco.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{eco.eco_number}</td>
                    <td className="py-3.5 px-4 font-medium text-slate-800">{eco.title}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-700">{eco.product?.part_number || '—'}</td>
                    <td className="py-3.5 px-4 text-center font-mono">rev {eco.active_revision_no}</td>
                    <td className="py-3.5 px-4">
                      <PriorityBadge priority={eco.priority} />
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={eco.status} />
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">{formatDate(eco.updated_at)}</td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        to={`/ecos/${eco.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors"
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

