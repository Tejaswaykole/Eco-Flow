import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProductService, BOMService } from '../../services';
import { PageHeader, EmptyState } from '../../components/ui/Cards';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badges';
import { Box, Layers, Plus, ArrowLeft, History, X } from 'lucide-react';
import { formatDate } from '../../lib/utils';

export function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [isBomModalOpen, setIsBomModalOpen] = useState(false);
  const [bomNumber, setBomNumber] = useState('');
  const [bomDesc, setBomDesc] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => ProductService.getProduct(id!),
    enabled: !!id,
  });

  const createBomMutation = useMutation({
    mutationFn: BOMService.createBOM,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', id] });
      setIsBomModalOpen(false);
      setBomNumber('');
      setBomDesc('');
    },
    onError: (err: any) => {
      setError(err.response?.data?.error?.message || 'Failed to initialize BOM');
    },
  });

  if (isLoading) {
    return <div className="p-8 text-center text-sm text-slate-500">Loading product specifications...</div>;
  }

  if (!product) {
    return <div className="p-8 text-center text-sm text-slate-500">Product not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link to="/products" className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Products</span>
        </Link>
      </div>

      <PageHeader
        title={`${product.part_number} — ${product.name}`}
        description={product.description || 'Hardware part specification definition.'}
      >
        <StatusBadge status={product.status} />
        <Button size="sm" onClick={() => setIsBomModalOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" />
          <span>Create BOM</span>
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">Part Specifications</h3>
          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-400 block uppercase font-medium">Part Number</span>
              <span className="font-mono font-bold text-slate-800 text-sm">{product.part_number}</span>
            </div>
            <div>
              <span className="text-slate-400 block uppercase font-medium">Category</span>
              <span className="font-semibold text-slate-700">{product.category?.name || 'Standard Hardware'}</span>
            </div>
            <div>
              <span className="text-slate-400 block uppercase font-medium">Active Release Version</span>
              <span className="font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800 inline-block mt-0.5">
                v{product.current_version}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block uppercase font-medium">Created On</span>
              <span className="text-slate-600">{formatDate(product.created_at)}</span>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-primary" />
              <span>Released Version History</span>
            </h3>
          </div>

          {(!product.product_versions || product.product_versions.length === 0) ? (
            <div className="p-6 text-center text-xs text-slate-400">
              Initial draft version. No formal ECO release history recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Version</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Effective Date</th>
                    <th className="py-2.5 px-3">Release Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {product.product_versions.map((v) => (
                    <tr key={v.id}>
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-800">v{v.version_number}</td>
                      <td className="py-2.5 px-3">
                        <StatusBadge status={v.release_status} />
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">{formatDate(v.effective_date)}</td>
                      <td className="py-2.5 px-3 text-slate-500">{formatDate(v.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Initialize BOM Modal */}
      {isBomModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Create Bill of Materials</h3>
              <button onClick={() => setIsBomModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                createBomMutation.mutate({
                  productId: product.id,
                  bomNumber,
                  description: bomDesc,
                });
              }}
              className="space-y-4 mt-4"
            >
              {error && <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">{error}</div>}

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700">BOM Number</label>
                <input
                  type="text"
                  required
                  placeholder={`BOM-${product.part_number}`}
                  value={bomNumber}
                  onChange={(e) => setBomNumber(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700">Description</label>
                <textarea
                  rows={3}
                  value={bomDesc}
                  onChange={(e) => setBomDesc(e.target.value)}
                  placeholder="Manufacturing BOM assembly tree definition..."
                  className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <Button variant="outline" size="sm" type="button" onClick={() => setIsBomModalOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit" isLoading={createBomMutation.isPending}>
                  Initialize BOM
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

