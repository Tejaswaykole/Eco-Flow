import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PurchasingService, SupplierService, ProductService, InventoryService } from '../../services';
import { PageHeader, EmptyState } from '../../components/ui/Cards';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badges';
import { ShoppingCart, Plus, Search, CheckCircle, Send, PackageCheck, X, Trash2, Calendar } from 'lucide-react';
import { formatDate, formatCurrency } from '../../lib/utils';
import { PurchaseOrder, PurchaseOrderLine } from '../../types';
import { useAuth } from '../../context/AuthContext';

export function PurchaseOrdersList() {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [isReceiveOpen, setIsReceiveOpen] = useState(false);

  // New PO form
  const [supplierId, setSupplierId] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Array<{ productId: string; quantityOrdered: number; unitPrice: number }>>([
    { productId: '', quantityOrdered: 1, unitPrice: 0 },
  ]);
  const [formError, setFormError] = useState<string | null>(null);

  // Receive goods form
  const [receiptWarehouseId, setReceiptWarehouseId] = useState('');
  const [receiptLines, setReceiptLines] = useState<Record<string, number>>({});
  const [receiveError, setReceiveError] = useState<string | null>(null);

  const { data: purchaseOrders = [], isLoading } = useQuery({
    queryKey: ['purchase-orders', statusFilter],
    queryFn: () => PurchasingService.listOrders({
      status: statusFilter === 'ALL' ? undefined : statusFilter,
    }),
  });

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers-dropdown'],
    queryFn: () => SupplierService.listSuppliers({ status: 'ACTIVE' }),
  });
  const suppliers = suppliersData?.suppliers || [];

  const { data: productsData } = useQuery({
    queryKey: ['products-dropdown'],
    queryFn: () => ProductService.listProducts(1, 100),
  });
  const products = productsData?.data || [];

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses-dropdown'],
    queryFn: () => InventoryService.listWarehouses(),
  });

  const createPOMutation = useMutation({
    mutationFn: PurchasingService.createOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      setIsCreateOpen(false);
      setSupplierId('');
      setDeliveryDate('');
      setNotes('');
      setLines([{ productId: '', quantityOrdered: 1, unitPrice: 0 }]);
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.error?.message || 'Failed to create PO');
    },
  });

  const submitPOMutation = useMutation({
    mutationFn: PurchasingService.submitOrder,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }),
  });

  const approvePOMutation = useMutation({
    mutationFn: PurchasingService.approveOrder,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }),
  });

  const receiveGoodsMutation = useMutation({
    mutationFn: (data: any) => PurchasingService.receiveGoods(selectedPO!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      setIsReceiveOpen(false);
      setSelectedPO(null);
      setReceiptLines({});
      setReceiveError(null);
    },
    onError: (err: any) => {
      setReceiveError(err.response?.data?.error?.message || 'Goods receipt failed');
    },
  });

  const addLine = () => {
    setLines([...lines, { productId: '', quantityOrdered: 1, unitPrice: 0 }]);
  };

  const removeLine = (idx: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== idx));
    }
  };

  const updateLine = (idx: number, field: string, value: any) => {
    const updated = [...lines];
    updated[idx] = { ...updated[idx], [field]: value };
    setLines(updated);
  };

  const openReceiveModal = (po: PurchaseOrder) => {
    setSelectedPO(po);
    const initialReceipts: Record<string, number> = {};
    po.lines?.forEach((line) => {
      const remaining = Math.max(0, Number(line.quantity_ordered) - Number(line.quantity_received));
      initialReceipts[line.id] = remaining;
    });
    setReceiptLines(initialReceipts);
    if (warehouses.length > 0) setReceiptWarehouseId(warehouses[0].id);
    setIsReceiveOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchasing & Procurement"
        description="Direct procurement workflows, purchase orders, multi-level approvals, and integrated inventory receipts."
      >
        {hasPermission('purchasing:write') && (
          <Button size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            <span>New Purchase Order</span>
          </Button>
        )}
      </PageHeader>

      <div className="flex flex-col sm:flex-row gap-4 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search purchase orders..."
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
          <option value="SUBMITTED">Submitted</option>
          <option value="APPROVED">Approved</option>
          <option value="PARTIALLY_RECEIVED">Partially Received</option>
          <option value="RECEIVED">Received</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading purchase orders...</div>
        ) : purchaseOrders.length === 0 ? (
          <div className="p-8 text-center">
            <EmptyState
              icon={ShoppingCart}
              title="No purchase orders"
              description="Create a purchase order to order materials from qualified vendors."
              action={
                <Button size="sm" onClick={() => setIsCreateOpen(true)}>
                  Create Purchase Order
                </Button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">PO Number</th>
                  <th className="px-6 py-3">Supplier</th>
                  <th className="px-6 py-3">Order Date</th>
                  <th className="px-6 py-3">Expected Date</th>
                  <th className="px-6 py-3 text-right">Total Amount</th>
                  <th className="px-6 py-3 text-center">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchaseOrders.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-3.5 font-mono font-medium text-slate-900">{po.po_number}</td>
                    <td className="px-6 py-3.5 font-medium text-slate-800">{po.supplier?.name}</td>
                    <td className="px-6 py-3.5 text-xs text-slate-500">{formatDate(po.order_date)}</td>
                    <td className="px-6 py-3.5 text-xs text-slate-500">
                      {po.expected_delivery_date ? formatDate(po.expected_delivery_date) : '—'}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(po.total_amount)}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      <StatusBadge status={po.status} />
                    </td>
                    <td className="px-6 py-3.5 text-right space-x-1">
                      {po.status === 'DRAFT' && hasPermission('purchasing:write') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => submitPOMutation.mutate(po.id)}
                          disabled={submitPOMutation.isPending}
                        >
                          <Send className="w-3.5 h-3.5 mr-1" />
                          Submit
                        </Button>
                      )}
                      {po.status === 'SUBMITTED' && hasPermission('purchasing:approve') && (
                        <Button
                          size="sm"
                          onClick={() => approvePOMutation.mutate(po.id)}
                          disabled={approvePOMutation.isPending}
                        >
                          <CheckCircle className="w-3.5 h-3.5 mr-1" />
                          Approve
                        </Button>
                      )}
                      {['APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED'].includes(po.status) && hasPermission('purchasing:write') && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                          onClick={() => openReceiveModal(po)}
                        >
                          <PackageCheck className="w-3.5 h-3.5 mr-1" />
                          Receive Goods
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create PO Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Create Purchase Order</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createPOMutation.mutate({
                  supplierId,
                  expectedDeliveryDate: deliveryDate || undefined,
                  notes: notes || undefined,
                  lines: lines.map((l) => ({
                    productId: l.productId,
                    quantityOrdered: Number(l.quantityOrdered),
                    unitPrice: Number(l.unitPrice),
                  })),
                });
              }}
              className="p-6 overflow-y-auto space-y-4 flex-1"
            >
              {formError && <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">{formError}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Supplier *</label>
                  <select
                    required
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                  >
                    <option value="">Select a supplier...</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.supplier_code} — {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Expected Delivery Date</label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">PO Notes / Terms</label>
                <textarea
                  rows={2}
                  placeholder="Special instructions or contract reference..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-800 uppercase tracking-wider">Line Items</span>
                  <Button type="button" size="sm" variant="outline" onClick={addLine}>
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Add Item
                  </Button>
                </div>

                <div className="space-y-3">
                  {lines.map((line, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <div className="flex-1">
                        <select
                          required
                          value={line.productId}
                          onChange={(e) => updateLine(idx, 'productId', e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-primary focus:outline-none"
                        >
                          <option value="">Select Product...</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.part_number} — {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="w-24">
                        <input
                          type="number"
                          min="1"
                          step="any"
                          required
                          placeholder="Qty"
                          value={line.quantityOrdered}
                          onChange={(e) => updateLine(idx, 'quantityOrdered', Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-right focus:ring-2 focus:ring-primary focus:outline-none"
                        />
                      </div>
                      <div className="w-28">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          placeholder="Price"
                          value={line.unitPrice}
                          onChange={(e) => updateLine(idx, 'unitPrice', Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-right focus:ring-2 focus:ring-primary focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        disabled={lines.length === 1}
                        className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createPOMutation.isPending}>
                  {createPOMutation.isPending ? 'Creating...' : 'Create Order'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receive Goods Modal */}
      {isReceiveOpen && selectedPO && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-900">Receive Goods: {selectedPO.po_number}</h3>
                <p className="text-xs text-slate-500">Log incoming shipments directly into inventory stock.</p>
              </div>
              <button onClick={() => setIsReceiveOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const itemsToReceive = Object.entries(receiptLines)
                  .filter(([_, qty]) => Number(qty) > 0)
                  .map(([lineId, qty]) => ({
                    lineId,
                    quantityReceived: Number(qty),
                  }));

                receiveGoodsMutation.mutate({
                  warehouseId: receiptWarehouseId,
                  items: itemsToReceive,
                });
              }}
              className="p-6 space-y-4"
            >
              {receiveError && <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">{receiveError}</div>}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Destination Warehouse *</label>
                <select
                  required
                  value={receiptWarehouseId}
                  onChange={(e) => setReceiptWarehouseId(e.target.value)}
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
                <span className="block text-xs font-medium text-slate-700 mb-2">Quantities Received:</span>
                <div className="space-y-2">
                  {selectedPO.lines?.map((line) => {
                    const remaining = Math.max(0, Number(line.quantity_ordered) - Number(line.quantity_received));
                    return (
                      <div key={line.id} className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs">
                        <div>
                          <div className="font-mono font-medium text-slate-800">{line.product?.part_number}</div>
                          <div className="text-[11px] text-slate-500">
                            Ordered: {Number(line.quantity_ordered)} | Recv'd: {Number(line.quantity_received)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500 text-[11px]">Receiving:</span>
                          <input
                            type="number"
                            min="0"
                            max={remaining}
                            step="any"
                            value={receiptLines[line.id] ?? 0}
                            onChange={(e) => setReceiptLines({ ...receiptLines, [line.id]: Number(e.target.value) })}
                            className="w-20 px-2 py-1 text-xs border border-slate-300 rounded bg-white text-right font-mono"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={() => setIsReceiveOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={receiveGoodsMutation.isPending}>
                  {receiveGoodsMutation.isPending ? 'Processing...' : 'Confirm Receipt'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
