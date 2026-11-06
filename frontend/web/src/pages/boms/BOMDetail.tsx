import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BOMService } from '../../services';
import { PageHeader, EmptyState } from '../../components/ui/Cards';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badges';
import {
  Layers,
  Plus,
  ArrowLeft,
  X,
  Trash2,
  AlertTriangle,
  Info,
  DollarSign,
  Calculator,
  FileSpreadsheet,
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';

const COMPONENT_CATEGORIES = [
  { value: 'RAW_MATERIAL', label: 'Raw Material / Ingredient', group: 'Primary Materials' },
  { value: 'CHEMICAL', label: 'Chemical / Resin / Adhesive', group: 'Primary Materials' },
  { value: 'SHEET_METAL', label: 'Sheet Metal & Fabrication', group: 'Structural & Mechanical' },
  { value: 'PLASTIC_MOLDED', label: 'Plastic Molded / Polymers', group: 'Structural & Mechanical' },
  { value: 'MECHANICAL', label: 'Mechanical Assembly / Parts', group: 'Structural & Mechanical' },
  { value: 'HARDWARE', label: 'Hardware / Fasteners / Brackets', group: 'Hardware' },
  { value: 'FASTENER', label: 'Screws, Bolts, Nuts & Rivets', group: 'Hardware' },
  { value: 'ELECTRONIC', label: 'Electronic Components (SMD / IC)', group: 'Electrical & Optics' },
  { value: 'ELECTRICAL', label: 'Electrical (Relays, Switches, Power)', group: 'Electrical & Optics' },
  { value: 'CABLE_WIRE', label: 'Cables, Wiring & Harnesses', group: 'Electrical & Optics' },
  { value: 'OPTICAL', label: 'Optics, Display & LEDs', group: 'Electrical & Optics' },
  { value: 'SUB_ASSEMBLY', label: 'Modular Sub-Assembly', group: 'Assembly & Tooling' },
  { value: 'TOOLING', label: 'Tooling & Custom Fixtures', group: 'Assembly & Tooling' },
  { value: 'SOFTWARE_FIRMWARE', label: 'Embedded Software / Firmware', group: 'Digital' },
  { value: 'CONSUMABLE', label: 'Consumables & Solder', group: 'Finishing & Packaging' },
  { value: 'LABEL_PRINTING', label: 'Labels, Badges & Printing', group: 'Finishing & Packaging' },
  { value: 'PACKAGING', label: 'Packaging, Foam & Boxing', group: 'Finishing & Packaging' },
  { value: 'OTHER', label: 'Other Ancillary Components', group: 'Other' },
];

export function BOMDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { hasRole, hasPermission } = useAuth();

  const [isComponentModalOpen, setIsComponentModalOpen] = useState(false);
  const [partNumber, setPartNumber] = useState('');
  const [name, setName] = useState('');
  const [componentType, setComponentType] = useState('RAW_MATERIAL');
  const [quantity, setQuantity] = useState(1);
  const [unitCost, setUnitCost] = useState(0);
  const [unitOfMeasure, setUnitOfMeasure] = useState('PCS');
  const [materialType, setMaterialType] = useState('');
  const [notes, setNotes] = useState('');
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
      setComponentType('RAW_MATERIAL');
      setQuantity(1);
      setUnitCost(0);
      setMaterialType('');
      setNotes('');
    },
    onError: (err: any) => {
      setError(err.response?.data?.error?.message || 'Failed to add line item component');
    },
  });

  const removeComponentMutation = useMutation({
    mutationFn: (componentId: string) => BOMService.removeComponent(id!, componentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom', id] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.error?.message || 'Failed to delete component');
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
  const liveSubtotal = (Number(quantity || 0) * Number(unitCost || 0)).toFixed(2);
  const isDraft = bom.status === 'DRAFT';
  const canEdit = isDraft && (hasRole('LEAD_ENGINEER') || hasRole('ADMINISTRATOR') || hasPermission('bom:write'));

  // Component Categorization breakdown
  const rawMaterialCost = components
    .filter((c) => c.component_type === 'RAW_MATERIAL')
    .reduce((acc, c) => acc + Number(c.total_cost || 0), 0);
  const electronicCost = components
    .filter((c) => c.component_type === 'ELECTRONIC')
    .reduce((acc, c) => acc + Number(c.total_cost || 0), 0);
  const otherCost = totalBOMCost - rawMaterialCost - electronicCost;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link to="/boms" className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to BOM Registry</span>
        </Link>
      </div>

      <PageHeader
        title={`${bom.bom_number} (v${bom.current_version})`}
        description={bom.description || 'Hierarchical Bill of Materials & Component Recipe Breakdown.'}
      >
        <StatusBadge status={bom.status} />
        {canEdit && (
          <Button size="sm" onClick={() => setIsComponentModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            <span>Add Item / Ingredient</span>
          </Button>
        )}
      </PageHeader>

      {/* Top Level Cost & Recipe Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Target Product Part</span>
          <span className="text-sm font-bold text-slate-900 font-mono mt-1 block">
            {bom.product?.part_number || 'N/A'}
          </span>
          <span className="text-[11px] text-slate-500 mt-0.5 block truncate">{bom.product?.name}</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Ingredients & Line Items</span>
          <span className="text-sm font-bold text-slate-900 mt-1 block">{components.length} Items</span>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Assembly recipe parts</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Aggregated Cost</span>
          <span className="text-xl font-bold text-emerald-700 font-mono mt-0.5 block">
            {formatCurrency(totalBOMCost)}
          </span>
          <span className="text-[10px] text-emerald-600 font-medium">Automatic real-time calculation</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Lifecycle State</span>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-800">{bom.status}</span>
            <span className="text-[11px] text-slate-400">{formatDate(bom.updated_at)}</span>
          </div>
          {!isDraft && (
            <span className="text-[10px] text-amber-700 font-medium block mt-0.5">
              Locked under released version. Requires ECO to edit.
            </span>
          )}
        </div>
      </div>

      {/* Cost Breakdown Analysis Banner */}
      {components.length > 0 && (
        <div className="bg-slate-900 text-slate-300 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-teal-400 shrink-0" />
            <span className="text-xs font-semibold text-white">Cost Distribution Analysis:</span>
          </div>
          <div className="flex items-center gap-6 text-xs font-mono">
            <div>
              <span className="text-slate-400 mr-1.5">Raw / Ingredients:</span>
              <span className="text-white font-bold">{formatCurrency(rawMaterialCost)}</span>
            </div>
            <div>
              <span className="text-slate-400 mr-1.5">Electronics:</span>
              <span className="text-white font-bold">{formatCurrency(electronicCost)}</span>
            </div>
            <div>
              <span className="text-slate-400 mr-1.5">Hardware & Other:</span>
              <span className="text-white font-bold">{formatCurrency(otherCost)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Assembly Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Components & Recipe Ingredients</h3>
            <p className="text-xs text-slate-500">Live cost aggregation, specifications, and engineering notes</p>
          </div>
          <span className="text-xs text-slate-400 font-mono">Decimal Precision Accounting</span>
        </div>

        {components.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No ingredients or components added"
            description="Add ingredients, parts, quantities, and cost specifications to calculate the total BOM."
            action={
              canEdit ? (
                <Button size="sm" onClick={() => setIsComponentModalOpen(true)}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  <span>Add First Item</span>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Part / Ingredient #</th>
                  <th className="py-3 px-4">Name & Description</th>
                  <th className="py-3 px-4">Category Type</th>
                  <th className="py-3 px-4 text-center">Quantity</th>
                  <th className="py-3 px-4 text-right">Unit Cost</th>
                  <th className="py-3 px-4 text-right">Calculated Total</th>
                  <th className="py-3 px-4">Cost Share</th>
                  {canEdit && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {components.map((comp) => {
                  const compTotal = Number(comp.total_cost || 0);
                  const sharePercentage = totalBOMCost > 0 ? ((compTotal / totalBOMCost) * 100).toFixed(1) : '0';

                  return (
                    <tr key={comp.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 align-top">
                        {comp.part_number}
                      </td>
                      <td className="py-3.5 px-4 align-top max-w-sm">
                        <div className="font-semibold text-slate-800 text-sm">{comp.name}</div>
                        {comp.notes && (
                          <div className="text-[11px] text-slate-500 mt-1 flex items-start gap-1">
                            <Info className="w-3 h-3 text-slate-400 mt-0.5 shrink-0" />
                            <span>{comp.notes}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 align-top">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px] font-bold text-slate-700 tracking-wide uppercase">
                          {comp.component_type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-semibold text-slate-800 align-top">
                        {comp.quantity} <span className="text-[10px] text-slate-500">{comp.unit_of_measure}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-600 align-top">
                        {formatCurrency(comp.unit_cost)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 text-sm align-top">
                        {formatCurrency(comp.total_cost)}
                      </td>
                      <td className="py-3.5 px-4 align-top">
                        <div className="flex items-center gap-1.5">
                          <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-primary h-full rounded-full"
                              style={{ width: `${Math.min(Number(sharePercentage), 100)}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono text-slate-500">{sharePercentage}%</span>
                        </div>
                      </td>
                      {canEdit && (
                        <td className="py-3.5 px-4 text-right align-top">
                          <button
                            onClick={() => {
                              if (confirm(`Remove component ${comp.part_number} from draft BOM?`)) {
                                removeComponentMutation.mutate(comp.id);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors rounded"
                            title="Remove line item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Component / Ingredient Modal */}
      {isComponentModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Add BOM Ingredient / Component</h3>
                <span className="text-xs text-slate-400">Calculates extended total cost automatically</span>
              </div>
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
                  notes: notes || undefined,
                });
              }}
              className="space-y-4 mt-4"
            >
              {error && <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">{error}</div>}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700">Part / Item #</label>
                  <input
                    type="text"
                    required
                    placeholder="ING-1001 or RES-10K"
                    value={partNumber}
                    onChange={(e) => setPartNumber(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700">Category / Type</label>
                  <select
                    value={componentType}
                    onChange={(e) => setComponentType(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                  >
                    {COMPONENT_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700">Component / Ingredient Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lithium Polymer Cell 2500mAh or Adhesive Resin"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Quantity, Cost & Live Subtotal Row */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-700">Quantity</label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      required
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                      className="mt-1 w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-700">Unit of Measure</label>
                    <input
                      type="text"
                      required
                      placeholder="PCS, KG, LTR, MTR"
                      value={unitOfMeasure}
                      onChange={(e) => setUnitOfMeasure(e.target.value.toUpperCase())}
                      className="mt-1 w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary uppercase font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-700">Unit Cost (₹)</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      required
                      value={unitCost}
                      onChange={(e) => setUnitCost(Number(e.target.value))}
                      className="mt-1 w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                    />
                  </div>
                </div>

                {/* Auto Calculated Extended Subtotal */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                  <span className="font-semibold text-slate-600 flex items-center gap-1.5">
                    <Calculator className="w-3.5 h-3.5 text-primary" />
                    <span>Calculated Extended Total:</span>
                  </span>
                  <span className="font-mono font-bold text-sm text-emerald-700">
                    {formatCurrency(liveSubtotal)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700">
                  Engineering Notes / Impact Details
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Material grade, supplier tolerance, substitution impact, or manufacturing note..."
                  className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <Button variant="outline" size="sm" type="button" onClick={() => setIsComponentModalOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit" isLoading={addComponentMutation.isPending}>
                  Add to BOM Recipe
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
