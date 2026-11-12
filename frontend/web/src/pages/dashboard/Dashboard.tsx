import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardService } from '../../services';
import { DashboardMetrics } from '../../types';
import { PageHeader, StatCard } from '../../components/ui/Cards';
import {
  Box,
  Layers,
  ClipboardList,
  GitPullRequest,
  CheckSquare,
  Bell,
  ShoppingCart,
  AlertTriangle,
  Factory,
  ShieldAlert,
  IndianRupee,
  Clock,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Link } from 'react-router-dom';
import { formatDate } from '../../lib/utils';

export function Dashboard() {
  const { data: metrics, isLoading } = useQuery<DashboardMetrics>({
    queryKey: ['dashboard', 'metrics'],
    queryFn: () => DashboardService.getMetrics(),
  });

  const kpis = metrics?.kpis;
  const charts = metrics?.charts;
  const recentActivity = metrics?.recentActivity || [];

  const ecoData = (charts?.ecoDistribution || []).map((d) => ({
    name: d.status.replace(/_/g, ' '),
    count: d.count,
  }));

  const poData = (charts?.poDistribution || []).map((d) => ({
    name: d.status.replace(/_/g, ' '),
    count: d.count,
  }));

  const woData = (charts?.woDistribution || []).map((d) => ({
    name: d.status.replace(/_/g, ' '),
    count: d.count,
  }));

  const ncrData = (charts?.ncrSeverity || []).map((d) => ({
    name: d.severity,
    count: d.count,
  }));

  const formatINR = (val?: string) => {
    if (!val) return '₹0.00';
    const num = parseFloat(val);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(num);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enterprise Operations & PLM Dashboard"
        description="Live operational telemetry, lifecycle approvals, inventory valuation, and production metrics."
      />

      {/* Primary KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          title="Products"
          value={isLoading ? '...' : kpis?.products ?? 0}
          description="Managed items"
          icon={Box}
        />
        <StatCard
          title="Active BOMs"
          value={isLoading ? '...' : kpis?.activeBOMs ?? 0}
          description="Product recipes"
          icon={Layers}
        />
        <StatCard
          title="Pending ECRs"
          value={isLoading ? '...' : kpis?.pendingECRs ?? 0}
          description="Change requests"
          icon={ClipboardList}
        />
        <StatCard
          title="Active ECOs"
          value={isLoading ? '...' : kpis?.activeECOs ?? 0}
          description="In review / draft"
          icon={GitPullRequest}
        />
        <StatCard
          title="Pending Approvals"
          value={isLoading ? '...' : kpis?.pendingApprovals ?? 0}
          description="Action required"
          icon={CheckSquare}
        />
        <StatCard
          title="Issued ECNs"
          value={isLoading ? '...' : kpis?.issuedECNs ?? 0}
          description="Notified changes"
          icon={Bell}
        />
      </div>

      {/* Secondary KPI Row: Operations & Finance */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          title="Open POs"
          value={isLoading ? '...' : kpis?.openPOs ?? 0}
          description="Purchasing pipeline"
          icon={ShoppingCart}
        />
        <StatCard
          title="Low Stock Alerts"
          value={isLoading ? '...' : kpis?.lowStockAlerts ?? 0}
          description="Below reorder point"
          icon={AlertTriangle}
        />
        <StatCard
          title="Active WOs"
          value={isLoading ? '...' : kpis?.activeWOs ?? 0}
          description="Manufacturing"
          icon={Factory}
        />
        <StatCard
          title="Open NCRs"
          value={isLoading ? '...' : kpis?.openNCRs ?? 0}
          description="Quality tickets"
          icon={ShieldAlert}
        />
        <StatCard
          title="Inventory Value"
          value={isLoading ? '...' : formatINR(kpis?.inventoryValuationINR)}
          description="Total stock valuation (INR)"
          icon={IndianRupee}
        />
        <StatCard
          title="Total PO Spend"
          value={isLoading ? '...' : formatINR(kpis?.poSpendINR)}
          description="Committed spend (INR)"
          icon={IndianRupee}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ECO Distribution Chart */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Engineering Change Orders (ECO)</h3>
              <p className="text-xs text-slate-500">Lifecycle status breakdown</p>
            </div>
            <Link to="/ecos" className="text-xs font-semibold text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ecoData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '11px' }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Bar dataKey="count" fill="#0f766e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Purchase Orders Chart */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Purchase Orders Status</h3>
              <p className="text-xs text-slate-500">Procurement pipeline status</p>
            </div>
            <Link to="/purchasing" className="text-xs font-semibold text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={poData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '11px' }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Work Orders Chart */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Manufacturing Work Orders</h3>
              <p className="text-xs text-slate-500">Shopfloor execution state</p>
            </div>
            <Link to="/manufacturing" className="text-xs font-semibold text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={woData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '11px' }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quality NCR Severity Chart */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Quality Non-Conformances</h3>
              <p className="text-xs text-slate-500">Severity distribution</p>
            </div>
            <Link to="/quality" className="text-xs font-semibold text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ncrData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '11px' }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Bar dataKey="count" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Activity Stream */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Live Enterprise Activity Log</h3>
            <p className="text-xs text-slate-500">Recent auditable business events across all subsystems</p>
          </div>
        </div>

        {recentActivity.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">No recent activity logged</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentActivity.map((act) => (
              <div key={act.id} className="py-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  <div>
                    <span className="font-semibold text-slate-900">{act.action.replace(/_/g, ' ')}</span>
                    <span className="text-slate-500 ml-2 font-mono text-[11px]">
                      ({act.entityType}: {act.entityId.slice(0, 8)}...)
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-slate-400 text-[11px]">
                  <span>By: {act.user}</span>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{formatDate(act.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
