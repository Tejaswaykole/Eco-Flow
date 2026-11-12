import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { InventoryService, ProductService } from '../../services';
import { PageHeader, EmptyState } from '../../components/ui/Cards';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badges';
import { Archive, Plus, Search, ArrowDownRight, ArrowUpRight, AlertTriangle, Building, X, History } from 'lucide-react';
import { formatDate, formatCurrency } from '../../lib/utils';
import { InventoryItem, Warehouse } from '../../types';
import { useAuth } from '../../context/AuthContext';

export function InventoryList() {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<'ITEMS' | 'WAREHOUSES' | 'TRANSACTIONS'>('ITEMS');
  const [search, setSearch] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('ALL');

  // Modals
  const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);
  const [isTransactModalOpen, setIsTransactModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  // New warehouse form
  const [whCode, setWhCode] = useState('');
  const [whName, setWhName] = useState('');
  const [whLocation, setWhLocation] = useState('');
  const [whError, setWhError] = useState<string | null>(null);

  // Transaction form
  const [txType, setTxType] = useState('ADJUSTMENT');
  const [txQty, setTxQty] = useState('1');
  const [txCost, setTxCost] = useState('0.00');
  const [txNotes, setTxNotes] = useState('');
  const [txError, setTxError] = useState<string | null>(null);

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => InventoryService.listWarehouses(),
  });

  const { data: inventoryItems = [], isLoading: isItemsLoading } = useQuery({
    queryKey: ['inventory-items', selectedWarehouseId],
    queryFn: () => InventoryService.listItems({
      warehouseId: selectedWarehouseId === 'ALL' ? undefined : selectedWarehouseId,
    }),
  });

  const { data: transactions = [], isLoading: isTxLoading } = useQuery({
    queryKey: ['inventory-transactions'],
    queryFn: () => InventoryService.listTransactions(),
    enabled: activeTab === 'TRANSACTIONS',
  });

  const createWarehouseMutation = useMutation({
    mutationFn: InventoryService.createWarehouse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      setIsWarehouseModalOpen(false);
      setWhCode('');
      setWhName('');
      setWhLocation('');
      setWhError(null);
    },
    onError: (err: any) => {
      setWhError(err.response?.data?.error?.message || 'Failed to create warehouse');
    },
  });

  const createTransactionMutation = useMutation({
    mutationFn: InventoryService.createTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-transactions'] });
      setIsTransactModalOpen(false);
      setTxQty('1');
      setTxNotes('');
      setTxError(null);
    },
    onError: (err: any) => {
      setTxError(err.response?.data?.error?.message || 'Transaction failed');
    },
  });

  const filteredItems = inventoryItems.filter((item) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      item.product?.part_number?.toLowerCase().includes(s) ||
      item.product?.name?.toLowerCase().includes(s) ||
      item.warehouse?.code?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory & Stock Management"
        description="Multi-warehouse stocking levels, stock adjustments, safety stock thresholds, and transaction audits."
      >
        {hasPermission('inventory:write') && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setIsWarehouseModalOpen(true)}>
              <Building className="w-4 h-4 mr-1.5" />
              <span>Add Warehouse</span>
            </Button>
          </div>
        )}
      </PageHeader>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('ITEMS')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'ITEMS'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Stock on Hand ({inventoryItems.length})
        </button>
        <button
          onClick={() => setActiveTab('WAREHOUSES')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'WAREHOUSES'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Warehouses ({warehouses.length})
        </button>
        <button
          onClick={() => setActiveTab('TRANSACTIONS')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'TRANSACTIONS'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Transaction History
        </button>
      </div>

      {activeTab === 'ITEMS' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search by part number, name, or warehouse..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="ALL">All Warehouses</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.code} — {wh.name}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {isItemsLoading ? (
              <div className="p-8 text-center text-sm text-slate-500">Loading inventory items...</div>
            ) : filteredItems.length === 0 ? (
              <div className="p-8 text-center">
                <EmptyState
                  icon={Archive}
                  title="No inventory records"
                  description="Goods receipts from Purchase Orders and stock transfers will populate this view."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3">Part Number</th>
                      <th className="px-6 py-3">Description</th>
                      <th className="px-6 py-3">Warehouse</th>
                      <th className="px-6 py-3 text-right">On Hand</th>
                      <th className="px-6 py-3 text-right">Reserved</th>
                      <th className="px-6 py-3 text-right">Min Safety</th>
                      <th className="px-6 py-3 text-center">Status</th>
                      <th className="px-6 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredItems.map((item) => {
                      const onHand = Number(item.quantity_on_hand);
                      const minThr = Number(item.min_threshold);
                      const isLowStock = onHand <= minThr;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-3.5 font-mono font-medium text-slate-900">
                            {item.product?.part_number || '—'}
                          </td>
                          <td className="px-6 py-3.5 text-slate-800">{item.product?.name || '—'}</td>
                          <td className="px-6 py-3.5">
                            <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                              {item.warehouse?.code}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 text-right font-mono font-semibold text-slate-900">
                            {onHand} {item.unit_of_measure}
                          </td>
                          <td className="px-6 py-3.5 text-right font-mono text-slate-500">
                            {Number(item.quantity_reserved)}
                          </td>
                          <td className="px-6 py-3.5 text-right font-mono text-slate-500">
                            {minThr}
                          </td>
                          <td className="px-6 py-3.5 text-center">
                            {isLowStock ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                Low Stock
                              </span>
                            ) : (
                              <span className="text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                                Sufficient
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-3.5 text-right">
                            {hasPermission('inventory:transact') && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedItem(item);
                                  setIsTransactModalOpen(true);
                                }}
                              >
                                Transact
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'WAREHOUSES' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {warehouses.map((wh) => (
            <div key={wh.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono font-bold text-sm bg-slate-100 px-2 py-0.5 rounded text-slate-800">
                  {wh.code}
                </span>
                <StatusBadge status={wh.status} />
              </div>
              <h4 className="font-semibold text-slate-900 text-base">{wh.name}</h4>
              <p className="text-xs text-slate-500 mt-1">{wh.location || 'No location specified'}</p>
              <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-400">
                Created {formatDate(wh.created_at)}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'TRANSACTIONS' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {isTxLoading ? (
            <div className="p-8 text-center text-sm text-slate-500">Loading ledger...</div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center">
              <EmptyState icon={History} title="No transaction entries recorded yet." />
            </div>
          ) : (
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Timestamp</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Product</th>
                  <th className="px-6 py-3 text-right">Quantity</th>
                  <th className="px-6 py-3 text-right">Unit Cost</th>
                  <th className="px-6 py-3 text-right">Total</th>
                  <th className="px-6 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/80">
                    <td className="px-6 py-3 text-xs text-slate-500">{formatDate(tx.created_at)}</td>
                    <td className="px-6 py-3 font-semibold text-xs text-slate-800">{tx.type}</td>
                    <td className="px-6 py-3 font-mono text-xs">{tx.item?.product?.part_number || '—'}</td>
                    <td className="px-6 py-3 text-right font-mono font-medium">{Number(tx.quantity)}</td>
                    <td className="px-6 py-3 text-right font-mono text-slate-500">{formatCurrency(tx.unit_cost)}</td>
                    <td className="px-6 py-3 text-right font-mono font-semibold text-slate-900">{formatCurrency(tx.total_cost)}</td>
                    <td className="px-6 py-3 text-xs text-slate-500">{tx.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Add Warehouse Modal */}
      {isWarehouseModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Add Warehouse</h3>
              <button onClick={() => setIsWarehouseModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createWarehouseMutation.mutate({ code: whCode, name: whName, location: whLocation || undefined });
              }}
              className="p-6 space-y-4"
            >
              {whError && <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">{whError}</div>}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Code *</label>
                <input
                  type="text"
                  required
                  placeholder="WH-MAIN"
                  value={whCode}
                  onChange={(e) => setWhCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Warehouse Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Main Assembly Plant"
                  value={whName}
                  onChange={(e) => setWhName(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Physical Location</label>
                <input
                  type="text"
                  placeholder="Building 4, Sector B"
                  value={whLocation}
                  onChange={(e) => setWhLocation(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={() => setIsWarehouseModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createWarehouseMutation.isPending}>
                  {createWarehouseMutation.isPending ? 'Saving...' : 'Save Warehouse'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Transaction Modal */}
      {isTransactModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-900">Record Stock Transaction</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  {selectedItem.product?.part_number} — {selectedItem.warehouse?.code}
                </p>
              </div>
              <button onClick={() => setIsTransactModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createTransactionMutation.mutate({
                  itemId: selectedItem.id,
                  type: txType,
                  quantity: Number(txQty),
                  unitCost: Number(txCost),
                  notes: txNotes || undefined,
                });
              }}
              className="p-6 space-y-4"
            >
              {txError && <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">{txError}</div>}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Transaction Type *</label>
                <select
                  value={txType}
                  onChange={(e) => setTxType(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                >
                  <option value="ADJUSTMENT">ADJUSTMENT (Cycle Count Correction)</option>
                  <option value="RECEIPT">RECEIPT (Add Physical Stock)</option>
                  <option value="ISSUE">ISSUE (Manual Consumption)</option>
                  <option value="SCRAP">SCRAP (Damage / Write-Off)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Quantity *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={txQty}
                    onChange={(e) => setTxQty(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Unit Cost (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={txCost}
                    onChange={(e) => setTxCost(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Audit Notes</label>
                <textarea
                  rows={2}
                  placeholder="Reason for adjustment..."
                  value={txNotes}
                  onChange={(e) => setTxNotes(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={() => setIsTransactModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createTransactionMutation.isPending}>
                  {createTransactionMutation.isPending ? 'Recording...' : 'Commit Transaction'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

