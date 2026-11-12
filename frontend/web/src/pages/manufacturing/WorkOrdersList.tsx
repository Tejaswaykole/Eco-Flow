import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ManufacturingService, ProductService, BOMService, InventoryService } from '../../services';
import { PageHeader, EmptyState } from '../../components/ui/Cards';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badges';
import { Factory, Plus, Search, Play, CheckCircle2, Flame, X, Layers, Box } from 'lucide-react';
import { formatDate } from '../../lib/utils';
import { WorkOrder, WorkOrderAllocation } from '../../types';
import { useAuth } from '../../context/AuthContext';

export function WorkOrdersList() {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
  const [isConsumeOpen, setIsConsumeOpen] = useState(false);
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);

  // New WO form
  const [productId, setProductId] = useState('');
  const [bomId, setBomId] = useState('');
  const [targetQuantity, setTargetQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Consume form
  const [selectedAllocationId, setSelectedAllocationId] = useState('');
  const [consumeWarehouseId, setConsumeWarehouseId] = useState('');
  const [consumeQty, setConsumeQty] = useState('1');
  const [consumeError, setConsumeError] = useState<string | null>(null);

  // Complete form
  const [completedQty, setCompletedQty] = useState('1');
  const [rejectedQty, setRejectedQty] = useState('0');
  const [destWarehouseId, setDestWarehouseId] = useState('');
  const [completeNotes, setCompleteNotes] = useState('');
  const [completeError, setCompleteError] = useState<string | null>(null);

  const { data: workOrders = [], isLoading } = useQuery({
    queryKey: ['work-orders', statusFilter],
    queryFn: () => ManufacturingService.listWorkOrders({
      status: statusFilter === 'ALL' ? undefined : statusFilter,
    }),
  });

  const { data: productsData } = useQuery({
    queryKey: ['products-dropdown'],
    queryFn: () => ProductService.listProducts(1, 100),
  });
  const products = productsData?.data || [];

  const { data: bomsData } = useQuery({
    queryKey: ['boms-dropdown'],
    queryFn: () => BOMService.listBOMs(1, 100),
  });
  const boms = bomsData?.data || [];

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses-dropdown'],
    queryFn: () => InventoryService.listWarehouses(),
  });

  // Filter BOMs based on selected product
  const availableBOMs = boms.filter((b) => !productId || b.product_id === productId);

  const createWOMutation = useMutation({
    mutationFn: ManufacturingService.createWorkOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      setIsCreateOpen(false);
      setProductId('');
      setBomId('');
      setTargetQuantity('1');
      setNotes('');
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.error?.message || 'Failed to create Work Order');
    },
  });

  const startWOMutation = useMutation({
    mutationFn: ManufacturingService.startWorkOrder,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['work-orders'] }),
  });

  const consumeMutation = useMutation({
    mutationFn: (data: any) => ManufacturingService.consumeMaterial(selectedWO!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      setIsConsumeOpen(false);
      setSelectedAllocationId('');
      setConsumeQty('1');
      setConsumeError(null);
    },
    onError: (err: any) => {
      setConsumeError(err.response?.data?.error?.message || 'Material consumption failed');
    },
  });

  const completeWOMutation = useMutation({
    mutationFn: (data: any) => ManufacturingService.completeWorkOrder(selectedWO!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      setIsCompleteOpen(false);
      setSelectedWO(null);
      setCompleteError(null);
    },
    onError: (err: any) => {
      setCompleteError(err.response?.data?.error?.message || 'Completion failed');
    },
  });

  const openConsumeModal = (wo: WorkOrder) => {
    setSelectedWO(wo);
    if (wo.allocations && wo.allocations.length > 0) {
      setSelectedAllocationId(wo.allocations[0].id);
      const rem = Math.max(0, Number(wo.allocations[0].required_quantity) - Number(wo.allocations[0].consumed_quantity));
      setConsumeQty(String(rem));
    }
    if (warehouses.length > 0) setConsumeWarehouseId(warehouses[0].id);
    setIsConsumeOpen(true);
  };

  const openCompleteModal = (wo: WorkOrder) => {
    setSelectedWO(wo);
    setCompletedQty(String(wo.target_quantity));
    setRejectedQty('0');
    if (warehouses.length > 0) setDestWarehouseId(warehouses[0].id);
    setIsCompleteOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manufacturing & Work Orders"
        description="Production runs, BOM material allocations, shop floor staging, and automated finished-goods inventory receipts."
      >
        {hasPermission('manufacturing:write') && (
          <Button size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            <span>New Work Order</span>
          </Button>
        )}
      </PageHeader>

      <div className="flex flex-col sm:flex-row gap-4 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search work orders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="ALL">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PLANNED">Planned</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading work orders...</div>
        ) : workOrders.length === 0 ? (
          <div className="p-8 text-center">
            <EmptyState
              icon={Factory}
              title="No work orders"
              description="Plan your next production build against an active Bill of Materials."
              action={
                <Button size="sm" onClick={() => setIsCreateOpen(true)}>
                  Create Work Order
                </Button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">WO Number</th>
                  <th className="px-6 py-3">Assembly Part</th>
                  <th className="px-6 py-3">BOM Reference</th>
                  <th className="px-6 py-3 text-right">Target Qty</th>
                  <th className="px-6 py-3 text-right">Completed</th>
                  <th className="px-6 py-3 text-center">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workOrders.map((wo) => (
                  <tr key={wo.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-3.5 font-mono font-medium text-slate-900">{wo.wo_number}</td>
                    <td className="px-6 py-3.5 font-medium text-slate-800">
                      {wo.product?.part_number} — <span className="text-slate-500 text-xs">{wo.product?.name}</span>
                    </td>
                    <td className="px-6 py-3.5 font-mono text-xs text-slate-600">{wo.bom?.bom_number}</td>
                    <td className="px-6 py-3.5 text-right font-mono font-bold text-slate-900">{Number(wo.target_quantity)}</td>
                    <td className="px-6 py-3.5 text-right font-mono font-medium text-emerald-700">
                      {Number(wo.completed_quantity)}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      <StatusBadge status={wo.status} />
                    </td>
                    <td className="px-6 py-3.5 text-right space-x-1">
                      {['DRAFT', 'PLANNED'].includes(wo.status) && hasPermission('manufacturing:execute') && (
                        <Button
                          size="sm"
                          onClick={() => startWOMutation.mutate(wo.id)}
                          disabled={startWOMutation.isPending}
                        >
                          <Play className="w-3.5 h-3.5 mr-1" />
                          Start Build
                        </Button>
                      )}
                      {wo.status === 'IN_PROGRESS' && hasPermission('manufacturing:execute') && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-amber-700 border-amber-300 hover:bg-amber-50"
                            onClick={() => openConsumeModal(wo)}
                          >
                            <Flame className="w-3.5 h-3.5 mr-1" />
                            Consume Mat.
                          </Button>
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => openCompleteModal(wo)}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            Complete
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create WO Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Create Work Order</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createWOMutation.mutate({
                  productId,
                  bomId,
                  targetQuantity: Number(targetQuantity),
                  notes: notes || undefined,
                });
              }}
              className="p-6 space-y-4"
            >
              {formError && <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">{formError}</div>}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Assembly Product *</label>
                <select
                  required
                  value={productId}
                  onChange={(e) => {
                    setProductId(e.target.value);
                    const matchingBOM = boms.find((b) => b.product_id === e.target.value);
                    if (matchingBOM) setBomId(matchingBOM.id);
                  }}
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                >
                  <option value="">Select assembly...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.part_number} — {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Bill of Materials *</label>
                <select
                  required
                  value={bomId}
                  onChange={(e) => setBomId(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                >
                  <option value="">Select BOM...</option>
                  {availableBOMs.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bom_number}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Target Build Quantity *</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={targetQuantity}
                  onChange={(e) => setTargetQuantity(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Production Notes</label>
                <textarea
                  rows={2}
                  placeholder="Special instructions or batch run tags..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createWOMutation.isPending}>
                  {createWOMutation.isPending ? 'Planning...' : 'Generate Work Order'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Consume Materials Modal */}
      {isConsumeOpen && selectedWO && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-900">Consume Component Stock</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{selectedWO.wo_number}</p>
              </div>
              <button onClick={() => setIsConsumeOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                consumeMutation.mutate({
                  allocationId: selectedAllocationId,
                  warehouseId: consumeWarehouseId,
                  quantityConsumed: Number(consumeQty),
                });
              }}
              className="p-6 space-y-4"
            >
              {consumeError && <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">{consumeError}</div>}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Allocated Component *</label>
                <select
                  required
                  value={selectedAllocationId}
                  onChange={(e) => {
                    setSelectedAllocationId(e.target.value);
                    const alloc = selectedWO.allocations?.find((a) => a.id === e.target.value);
                    if (alloc) {
                      const rem = Math.max(0, Number(alloc.required_quantity) - Number(alloc.consumed_quantity));
                      setConsumeQty(String(rem));
                    }
                  }}
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                >
                  {selectedWO.allocations?.map((alloc) => (
                    <option key={alloc.id} value={alloc.id}>
                      {alloc.product?.part_number} (Req: {Number(alloc.required_quantity)}, Consumed: {Number(alloc.consumed_quantity)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Source Warehouse *</label>
                <select
                  required
                  value={consumeWarehouseId}
                  onChange={(e) => setConsumeWarehouseId(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                >
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.code} — {wh.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Quantity to Consume *</label>
                <input
                  type="number"
                  step="any"
                  min="0.001"
                  required
                  value={consumeQty}
                  onChange={(e) => setConsumeQty(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={() => setIsConsumeOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={consumeMutation.isPending}>
                  {consumeMutation.isPending ? 'Logging...' : 'Consume Material'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete WO Modal */}
      {isCompleteOpen && selectedWO && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-900">Complete Work Order</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{selectedWO.wo_number}</p>
              </div>
              <button onClick={() => setIsCompleteOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                completeWOMutation.mutate({
                  completedQuantity: Number(completedQty),
                  rejectedQuantity: Number(rejectedQty),
                  warehouseId: destWarehouseId || undefined,
                  notes: completeNotes || undefined,
                });
              }}
              className="p-6 space-y-4"
            >
              {completeError && <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">{completeError}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Completed Qty *</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={completedQty}
                    onChange={(e) => setCompletedQty(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Scrap / Rejected Qty</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={rejectedQty}
                    onChange={(e) => setRejectedQty(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Stocking Warehouse (Finished Goods)</label>
                <select
                  value={destWarehouseId}
                  onChange={(e) => setDestWarehouseId(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                >
                  <option value="">Select warehouse (optional)...</option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.code} — {wh.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Completion Notes</label>
                <textarea
                  rows={2}
                  placeholder="Final QA signoff remarks..."
                  value={completeNotes}
                  onChange={(e) => setCompleteNotes(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={() => setIsCompleteOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={completeWOMutation.isPending}>
                  {completeWOMutation.isPending ? 'Closing...' : 'Close & Receipt Stock'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
