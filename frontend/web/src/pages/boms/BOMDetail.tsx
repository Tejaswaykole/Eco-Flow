import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BOMService } from '../../services';
import { PageHeader, EmptyState } from '../../components/ui/Cards';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badges';
import { Layers, Plus, ArrowLeft, X, DollarSign } from 'lucide-react';
import { formatCurrency, formatDate } from '../../lib/utils';

export function BOMDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [isComponentModalOpen, setIsComponentModalOpen] = useState(false);
  const [partNumber, setPartNumber] = useState('');
  const [name, setName] = useState('');
  const [componentType, setComponentType] = useState('ELECTRONIC');
  const [quantity, setQuantity] = useState(1);
  const [unitCost, setUnitCost] = useState(0);
  const [unitOfMeasure, setUnitOfMeasure] = useState('PCS');
  const [error, setError] = useState<string | null>(null);

  const { data: bom, isLoading } = useQuery({
    queryKey: ['bom', id],
    queryFn: () => BOMService.getBOM(id!),
    enabled: !!id,
  });

  const addComponentMutation = useMutation({
    mutationFn: (payload: any) => BOMService.addComponent(id!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom', id] });
      setIsComponentModalOpen(false);
      setPartNumber('');
      setName('');
      setQuantity(1);
      setUnitCost(0);
    },
    onError: (err: any) => {
      setError(err.response?.data?.error?.message || 'Failed to add line item component');
    },
  });

  if (isLoading) {
    return <div className="p-8 text-center text-sm text-slate-500">Loading BOM assembly structure...</div>;
  }

  if (!bom) {
    return (
      <div className="p-8 text-center text-sm text-slate-500">
        Bill of Materials not found. Return to{' '}
        <Link to="/products" className="text-primary font-semibold underline">
          products catalog
        </Link>
        .
      </div>
    );
  }

  const components = bom.components || [];
  const totalBOMCost = components.reduce((acc, c) => acc + Number(c.total_cost || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link to="/products" className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Catalog</span>
        </Link>
      </div>

      <PageHeader
        title={`${bom.bom_number} (v${bom.current_version})`}
        description={bom.description || 'Hierarchical Bill of Materials Component Structure.'}
      >
        <StatusBadge status={bom.status} />
        {bom.status === 'DRAFT' && (
          <Button size="sm" onClick={() => setIsComponentModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            <span>Add Component</span>
          </Button>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Part Association</span>
          <span className="text-sm font-bold text-slate-900 font-mono mt-1 block">
            {bom.product?.part_number || 'N/A'}
          </span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Components</span>
          <span className="text-sm font-bold text-slate-900 mt-1 block">{components.length} Line Items</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Roll-up Unit Cost</span>
          <span className="text-sm font-bold text-emerald-700 mt-1 block font-mono">
            {formatCurrency(totalBOMCost)}
          </span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Last Updated</span>
          <span className="text-sm text-slate-600 mt-1 block">{formatDate(bom.updated_at)}</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Components & Assembly Line Items</h3>
          <span className="text-xs text-slate-400">Strict Decimal Precision Accounting</span>
        </div>

        {components.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No components added"
            description="Add line items to populate the bill of materials assembly tree."
            action={
              bom.status === 'DRAFT' ? (
                <Button size="sm" onClick={() => setIsComponentModalOpen(true)}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  <span>Add First Component</span>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Part #</th>
                  <th className="py-3 px-4">Component Name</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-center">Quantity</th>
                  <th className="py-3 px-4 text-right">Unit Cost</th>
                  <th className="py-3 px-4 text-right">Extended Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {components.map((comp) => (
                  <tr key={comp.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">{comp.part_number}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">{comp.name}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px] font-semibold text-slate-600">
                        {comp.component_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-semibold">
                      {comp.quantity} {comp.unit_of_measure}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">
                      {formatCurrency(comp.unit_cost)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(comp.total_cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Component Modal */}
      {isComponentModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Add Line Item Component</h3>
              <button onClick={() => setIsComponentModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                addComponentMutation.mutate({
                  partNumber,
                  name,
                  componentType,
                  quantity: Number(quantity),
                  unitCost: Number(unitCost),
                  unitOfMeasure,
                });
              }}
              className="space-y-4 mt-4"
            >
              {error && <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">{error}</div>}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700">Part Number</label>
                  <input
                    type="text"
                    required
                    placeholder="RES-10K-0805"
                    value={partNumber}
                    onChange={(e) => setPartNumber(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700">Component Type</label>
                  <select
                    value={componentType}
                    onChange={(e) => setComponentType(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="ELECTRONIC">ELECTRONIC</option>
                    <option value="HARDWARE">HARDWARE</option>
                    <option value="RAW_MATERIAL">RAW_MATERIAL</option>
                    <option value="SUB_ASSEMBLY">SUB_ASSEMBLY</option>
                    <option value="PACKAGING">PACKAGING</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700">Component Name</label>
                <input
                  type="text"
                  required
                  placeholder="Surface Mount Resistor 10k"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700">Unit Cost ($)</label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    required
                    value={unitCost}
                    onChange={(e) => setUnitCost(Number(e.target.value))}
                    className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700">Unit</label>
                  <input
                    type="text"
                    required
                    value={unitOfMeasure}
                    onChange={(e) => setUnitOfMeasure(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <Button variant="outline" size="sm" type="button" onClick={() => setIsComponentModalOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit" isLoading={addComponentMutation.isPending}>
                  Add Line Item
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
