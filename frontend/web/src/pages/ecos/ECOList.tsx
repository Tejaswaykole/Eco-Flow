import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ECOService, ProductService } from '../../services';
import { PageHeader, EmptyState } from '../../components/ui/Cards';
import { Button } from '../../components/ui/Button';
import { StatusBadge, PriorityBadge } from '../../components/ui/Badges';
import { GitPullRequest, Plus, X, Search } from 'lucide-react';
import { formatDate } from '../../lib/utils';
import { Link } from 'react-router-dom';

export function ECOList() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Create form state
  const [ecoNumber, setEcoNumber] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [productId, setProductId] = useState('');
  const [bomId, setBomId] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [error, setError] = useState<string | null>(null);

  const { data: ecosData, isLoading } = useQuery({
    queryKey: ['ecos', statusFilter],
    queryFn: () => ECOService.listECOs(1, 100, statusFilter || undefined),
  });

  const { data: productsData } = useQuery({
    queryKey: ['products', 'eco-select'],
    queryFn: () => ProductService.listProducts(1, 100),
  });

  const ecos = ecosData?.data || [];
  const products = productsData?.data || [];

  const createEcoMutation = useMutation({
    mutationFn: (payload: any) => {
      const idempotencyKey = `create-eco-${Date.now()}`;
      return ECOService.createECO(payload, idempotencyKey);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ecos'] });
      setIsCreateOpen(false);
      setEcoNumber('');
      setTitle('');
      setDescription('');
      setProductId('');
      setBomId('');
    },
    onError: (err: any) => {
      setError(err.response?.data?.error?.message || 'Failed to create ECO order');
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Engineering Change Orders (ECO)"
        description="Formal engineering change workflow, revision freezes, and multi-stage approval releases."
      >
        <Button size="sm" onClick={() => setIsCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" />
          <span>New Change Order</span>
        </Button>
      </PageHeader>

      <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-medium px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading change orders...</div>
        ) : ecos.length === 0 ? (
          <EmptyState
            icon={GitPullRequest}
            title="No change orders found"
            description="Create a new ECO to initiate revision proposals on hardware BOM components."
            action={
              <Button size="sm" onClick={() => setIsCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-1.5" />
                <span>Create Change Order</span>
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">ECO #</th>
                  <th className="py-3 px-4">Title</th>
                  <th className="py-3 px-4">Product Part</th>
                  <th className="py-3 px-4 text-center">Revision</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Workflow Status</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ecos.map((eco) => (
                  <tr key={eco.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{eco.eco_number}</td>
                    <td className="py-3.5 px-4 font-medium text-slate-800">
                      {eco.title}
                      {eco.description && (
                        <div className="text-[11px] text-slate-400 truncate max-w-sm">{eco.description}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-700">
                      {eco.product?.part_number || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-block px-2 py-0.5 rounded bg-slate-100 font-mono text-[11px] font-semibold text-slate-700">
                        rev {eco.active_revision_no}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <PriorityBadge priority={eco.priority} />
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={eco.status} />
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">{formatDate(eco.created_at)}</td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        to={`/ecos/${eco.id}`}
                        className="font-semibold text-primary hover:text-primary-hover hover:underline"
                      >
                        Workspace
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create ECO Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Initiate Engineering Change Order</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                createEcoMutation.mutate({
                  ecoNumber,
                  title,
                  description,
                  productId,
                  bomId,
                  priority,
                });
              }}
              className="space-y-4 mt-4"
            >
              {error && <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">{error}</div>}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700">ECO Number</label>
                  <input
                    type="text"
                    required
                    placeholder="ECO-2026-001"
                    value={ecoNumber}
                    onChange={(e) => setEcoNumber(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700">Change Order Title</label>
                <input
                  type="text"
                  required
                  placeholder="Upgrade MCU to Industrial Temperature Grade"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700">Target Product</label>
                  <select
                    required
                    value={productId}
                    onChange={(e) => {
                      setProductId(e.target.value);
                    }}
                    className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Select target product...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.part_number} — {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700">Target BOM ID (UUID)</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter valid BOM UUID"
                    value={bomId}
                    onChange={(e) => setBomId(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700">Justification & Scope</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe engineering rationale, component substitutions, and validation requirements..."
                  className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <Button variant="outline" size="sm" type="button" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit" isLoading={createEcoMutation.isPending}>
                  Initiate Change Order
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
