import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ProductService, ECOService } from '../../services';
import { PageHeader, StatCard, EmptyState } from '../../components/ui/Cards';
import { StatusBadge, PriorityBadge } from '../../components/ui/Badges';
import { Box, GitPullRequest, Layers, Clock, CheckCircle2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Link } from 'react-router-dom';
import { formatDate } from '../../lib/utils';

export function Dashboard() {
  const { data: productsData, isLoading: loadingProducts } = useQuery({
    queryKey: ['products', 'dashboard'],
    queryFn: () => ProductService.listProducts(1, 100),
  });

  const { data: ecosData, isLoading: loadingECOs } = useQuery({
    queryKey: ['ecos', 'dashboard'],
    queryFn: () => ECOService.listECOs(1, 100),
  });

  const products = productsData?.data || [];
  const ecos = ecosData?.data || [];

  const pendingApprovalsCount = ecos.filter(
    (e) => e.status === 'SUBMITTED' || e.status === 'UNDER_REVIEW'
  ).length;

  const approvedEcosCount = ecos.filter((e) => e.status === 'APPROVED').length;
  const draftEcosCount = ecos.filter((e) => e.status === 'DRAFT').length;

  const statusChartData = [
    { name: 'Draft', count: draftEcosCount },
    { name: 'Pending Review', count: pendingApprovalsCount },
    { name: 'Approved', count: approvedEcosCount },
    { name: 'Rejected/Cancelled', count: ecos.filter((e) => e.status === 'REJECTED' || e.status === 'CANCELLED').length },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Engineering Operations Dashboard"
        description="Real-time metrics, active change orders, and revision releases."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Total Products"
          value={loadingProducts ? '...' : products.length}
          description="Managed active catalog parts"
          icon={Box}
        />
        <StatCard
          title="Active ECO Orders"
          value={loadingECOs ? '...' : ecos.length}
          description="Total change records"
          icon={GitPullRequest}
        />
        <StatCard
          title="Pending Approvals"
          value={loadingECOs ? '...' : pendingApprovalsCount}
          description="Awaiting reviewer signoff"
          icon={Clock}
        />
        <StatCard
          title="Approved Releases"
          value={loadingECOs ? '...' : approvedEcosCount}
          description="Promoted to manufacturing"
          icon={CheckCircle2}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">ECO Status Distribution</h3>
              <p className="text-xs text-slate-500">Live breakdown of engineering change workflows</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px' }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Bar dataKey="count" fill="#0f766e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900">Recent Change Orders</h3>
            <Link to="/ecos" className="text-xs font-semibold text-primary hover:underline">
              View all
            </Link>
          </div>

          {ecos.length === 0 ? (
            <EmptyState title="No active ECOs" description="Create an engineering change order to track revisions." />
          ) : (
            <div className="divide-y divide-slate-100">
              {ecos.slice(0, 5).map((eco) => (
                <div key={eco.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0 flex-1">
                    <Link to={`/ecos/${eco.id}`} className="font-semibold text-slate-900 hover:text-primary truncate block">
                      {eco.eco_number} — {eco.title}
                    </Link>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Updated {formatDate(eco.updated_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={eco.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

