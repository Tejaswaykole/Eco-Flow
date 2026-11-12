import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SupplierService, ProductService } from '../../services';
import { PageHeader, EmptyState } from '../../components/ui/Cards';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badges';
import {
  Truck,
  Plus,
  Search,
  Mail,
  Phone,
  MapPin,
  Star,
  X,
  Check,
  PackagePlus,
  FileSpreadsheet,
  Download,
  Upload,
  ArrowRightLeft,
  DollarSign,
  TrendingUp,
  Clock,
  Layers,
  History,
  CheckCircle,
  AlertTriangle,
  FileText,
  MessageSquare,
  ShieldCheck,
  ChevronRight,
  Filter,
  RefreshCw,
  Edit2,
} from 'lucide-react';
import { formatDate, formatCurrency } from '../../lib/utils';
import {
  Supplier,
  SupplierStatus,
  SupplierProduct,
  RFQ,
  SupplierQuotation,
  SupplierPerformanceAnalytics,
} from '../../types';
import { useAuth } from '../../context/AuthContext';

export function SuppliersList() {
  const queryClient = useQueryClient();
  const { hasPermission, user } = useAuth();

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);

  // Modals & Profile Drawers
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [profileTab, setProfileTab] = useState<'overview' | 'products' | 'quotations' | 'history' | 'performance' | 'import_export'>('overview');
  
  // Phase 2 modals
  const [isBulkMapOpen, setIsBulkMapOpen] = useState(false);
  const [isSingleMapOpen, setIsSingleMapOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<SupplierProduct | null>(null);
  const [comparingProductId, setComparingProductId] = useState<string | null>(null);

  // Phase 3 modals
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [importPreviewData, setImportPreviewData] = useState<any | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Phase 4 modals
  const [isCreateRFQOpen, setIsCreateRFQOpen] = useState(false);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [negotiatingQuote, setNegotiatingQuote] = useState<SupplierQuotation | null>(null);
  const [counterPriceInput, setCounterPriceInput] = useState<string>('');
  const [negotiationMsgInput, setNegotiationMsgInput] = useState<string>('');

  // Form states - Create Supplier
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [rating, setRating] = useState(5);
  const [formError, setFormError] = useState<string | null>(null);

  // Single Map state
  const [mapProductId, setMapProductId] = useState('');
  const [mapPartNumber, setMapPartNumber] = useState('');
  const [mapUnitPrice, setMapUnitPrice] = useState('0.00');
  const [mapLeadTime, setMapLeadTime] = useState(7);
  const [mapMoq, setMapMoq] = useState('1');
  const [mapIsPreferred, setMapIsPreferred] = useState(false);

  // Edit Mapping state
  const [editPartNumber, setEditPartNumber] = useState('');
  const [editUnitPrice, setEditUnitPrice] = useState('0');
  const [editLeadTime, setEditLeadTime] = useState(7);
  const [editMoq, setEditMoq] = useState('1');
  const [editIsPreferred, setEditIsPreferred] = useState(false);

  // Bulk Map state: set of selected product IDs
  const [selectedBulkProductIds, setSelectedBulkProductIds] = useState<Record<string, boolean>>({});
  const [bulkUnitPrice, setBulkUnitPrice] = useState('0.00');
  const [bulkLeadTime, setBulkLeadTime] = useState(7);
  const [bulkMoq, setBulkMoq] = useState('1');

  // RFQ Creation state
  const [rfqTitle, setRfqTitle] = useState('');
  const [rfqDeliveryDate, setRfqDeliveryDate] = useState('');
  const [rfqDeadlineDate, setRfqDeadlineDate] = useState('');
  const [rfqNotes, setRfqNotes] = useState('');
  const [rfqSelectedSuppliers, setRfqSelectedSuppliers] = useState<string[]>([]);
  const [rfqItems, setRfqItems] = useState<{ productId: string; quantityRequired: number; notes: string }[]>([
    { productId: '', quantityRequired: 1, notes: '' },
  ]);

  // Quotation Creation state
  const [quoteProductId, setQuoteProductId] = useState('');
  const [quoteUnitPrice, setQuoteUnitPrice] = useState('0.00');
  const [quoteQty, setQuoteQty] = useState('1');
  const [quoteTax, setQuoteTax] = useState('0.00');
  const [quoteShipping, setQuoteShipping] = useState('0.00');
  const [quoteLeadTime, setQuoteLeadTime] = useState(7);
  const [quoteMoq, setQuoteMoq] = useState('1');
  const [quoteTerms, setQuoteTerms] = useState('');

  // 1. Dashboard Stats Query (Phase 1)
  const { data: stats } = useQuery({
    queryKey: ['supplier-dashboard-stats'],
    queryFn: () => SupplierService.getDashboardStats(),
  });

  // 2. Categories for Filter (Phase 1)
  const { data: categories = [] } = useQuery({
    queryKey: ['categories-filter'],
    queryFn: () => ProductService.listCategories(),
  });

  // 3. Suppliers Listing Query (Phase 1)
  const { data: suppliersResponse, isLoading, refetch: refetchSuppliers } = useQuery({
    queryKey: ['suppliers', statusFilter, search, categoryFilter, page],
    queryFn: () =>
      SupplierService.listSuppliers({
        page,
        limit: 20,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        search: search.trim() || undefined,
        categoryId: categoryFilter === 'ALL' ? undefined : categoryFilter,
      }),
  });
  const suppliers = suppliersResponse?.suppliers || [];
  const pagination = suppliersResponse?.pagination;

  // 4. Products for Select dropdowns
  const { data: productsData } = useQuery({
    queryKey: ['products-select-full'],
    queryFn: () => ProductService.listProducts(1, 200),
  });
  const products = productsData?.data || [];

  // 5. Selected Supplier Details Query (when profile drawer is open)
  const { data: activeSupplierDetail, refetch: refetchActiveSupplier } = useQuery({
    queryKey: ['supplier-detail', selectedSupplier?.id],
    queryFn: () => (selectedSupplier?.id ? SupplierService.getSupplier(selectedSupplier.id) : null),
    enabled: !!selectedSupplier?.id,
  });

  // 6. Selected Supplier Performance Query (Phase 5)
  const { data: performanceAnalytics } = useQuery({
    queryKey: ['supplier-performance', selectedSupplier?.id],
    queryFn: () => (selectedSupplier?.id ? SupplierService.getSupplierPerformance(selectedSupplier.id) : null),
    enabled: !!selectedSupplier?.id && profileTab === 'performance',
  });

  // 7. RFQ List Query (Phase 4)
  const { data: rfqsList = [], refetch: refetchRFQs } = useQuery({
    queryKey: ['rfqs-list'],
    queryFn: () => SupplierService.listRFQs(),
  });

  // 8. Product Price Comparison Query (Phase 2 & 4)
  const { data: comparisonData } = useQuery({
    queryKey: ['product-comparison', comparingProductId],
    queryFn: () => (comparingProductId ? SupplierService.getProductSuppliersComparison(comparingProductId) : null),
    enabled: !!comparingProductId,
  });

  // MUTATIONS
  const createSupplierMutation = useMutation({
    mutationFn: SupplierService.createSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-dashboard-stats'] });
      setIsCreateOpen(false);
      setName('');
      setContactName('');
      setEmail('');
      setPhone('');
      setAddress('');
      setRating(5);
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.error?.message || err.message || 'Failed to create supplier');
    },
  });

  const addProductMutation = useMutation({
    mutationFn: (data: any) => SupplierService.addSupplierProduct(selectedSupplier!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-detail', selectedSupplier?.id] });
      queryClient.invalidateQueries({ queryKey: ['supplier-dashboard-stats'] });
      setIsSingleMapOpen(false);
      setMapProductId('');
      setMapPartNumber('');
      setMapUnitPrice('0.00');
    },
    onError: (err: any) => {
      alert(err.response?.data?.error?.message || 'Failed to map product');
    },
  });

  const bulkMapMutation = useMutation({
    mutationFn: (mappings: any[]) =>
      SupplierService.bulkMapProducts(selectedSupplier!.id, { mappings }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-detail', selectedSupplier?.id] });
      queryClient.invalidateQueries({ queryKey: ['supplier-dashboard-stats'] });
      setIsBulkMapOpen(false);
      setSelectedBulkProductIds({});
    },
    onError: (err: any) => {
      alert(err.response?.data?.error?.message || 'Bulk mapping failed');
    },
  });

  const updateMappingMutation = useMutation({
    mutationFn: (data: { supplierId: string; productId: string; payload: any }) =>
      SupplierService.updateSupplierProduct(data.supplierId, data.productId, data.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-detail', selectedSupplier?.id] });
      setEditingMapping(null);
    },
    onError: (err: any) => {
      alert(err.response?.data?.error?.message || 'Failed to update mapping');
    },
  });

  const removeMappingMutation = useMutation({
    mutationFn: (data: { supplierId: string; productId: string }) =>
      SupplierService.removeSupplierProduct(data.supplierId, data.productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-detail', selectedSupplier?.id] });
      queryClient.invalidateQueries({ queryKey: ['supplier-dashboard-stats'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.error?.message || 'Failed to remove mapping');
    },
  });

  const commitImportMutation = useMutation({
    mutationFn: (rows: any[]) => SupplierService.commitImport(selectedSupplier!.id, { rows }),
    onSuccess: (res) => {
      alert(`Successfully imported ${res.importedCount} product mappings!`);
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-detail', selectedSupplier?.id] });
      queryClient.invalidateQueries({ queryKey: ['supplier-dashboard-stats'] });
      setIsImportOpen(false);
      setImportPreviewData(null);
      setImportRows([]);
    },
    onError: (err: any) => {
      setImportError(err.response?.data?.error?.message || 'Import commit failed');
    },
  });

  const createRFQMutation = useMutation({
    mutationFn: SupplierService.createRFQ,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rfqs-list'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-dashboard-stats'] });
      setIsCreateRFQOpen(false);
      setRfqTitle('');
      setRfqDeliveryDate('');
      setRfqDeadlineDate('');
      setRfqNotes('');
      setRfqSelectedSuppliers([]);
      setRfqItems([{ productId: '', quantityRequired: 1, notes: '' }]);
      alert('Request for Quotation created successfully!');
    },
    onError: (err: any) => {
      alert(err.response?.data?.error?.message || 'Failed to create RFQ');
    },
  });

  const createQuotationMutation = useMutation({
    mutationFn: SupplierService.createQuotation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-detail', selectedSupplier?.id] });
      queryClient.invalidateQueries({ queryKey: ['rfqs-list'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-dashboard-stats'] });
      setIsQuoteModalOpen(false);
      setQuoteProductId('');
      setQuoteUnitPrice('0.00');
      alert('Quotation recorded successfully!');
    },
    onError: (err: any) => {
      alert(err.response?.data?.error?.message || 'Failed to record quotation');
    },
  });

  const negotiateMutation = useMutation({
    mutationFn: (data: { quoteId: string; eventType: any; counterPrice: number; message: string }) =>
      SupplierService.negotiateQuotation(data.quoteId, {
        eventType: data.eventType,
        counterPrice: data.counterPrice,
        message: data.message,
        currency: 'INR',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-detail', selectedSupplier?.id] });
      queryClient.invalidateQueries({ queryKey: ['rfqs-list'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-dashboard-stats'] });
      setNegotiatingQuote(null);
      setCounterPriceInput('');
      setNegotiationMsgInput('');
      alert('Negotiation action recorded successfully!');
    },
    onError: (err: any) => {
      alert(err.response?.data?.error?.message || 'Failed to update negotiation');
    },
  });

  const convertToPOMutation = useMutation({
    mutationFn: (quoteId: string) => SupplierService.convertQuotationToPO(quoteId),
    onSuccess: (po) => {
      queryClient.invalidateQueries({ queryKey: ['supplier-detail', selectedSupplier?.id] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-dashboard-stats'] });
      alert(`Purchase Order ${po.po_number} created successfully! Pending Approver authorization.`);
    },
    onError: (err: any) => {
      alert(err.response?.data?.error?.message || 'Failed to convert quotation to PO');
    },
  });

  // Handlers for CSV Import & Export
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        const lines = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) {
          setImportError('File must contain at least a header row and one data row.');
          return;
        }

        const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
        const rows = lines.slice(1).map((line) => {
          const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
          const rowObj: any = {};
          headers.forEach((h, idx) => {
            rowObj[h] = values[idx] ?? '';
          });
          return rowObj;
        });

        setImportRows(rows);
        setImportError(null);

        // Run preview validation with backend
        const preview = await SupplierService.previewImport(selectedSupplier!.id, { rows });
        setImportPreviewData(preview);
      } catch (err: any) {
        setImportError(err.message || 'Failed to parse file');
      }
    };
    reader.readAsText(file);
  };

  const handleExport = async (type: string, format: 'csv' | 'json') => {
    try {
      const data = await SupplierService.exportData({
        type,
        format,
        supplierId: selectedSupplier?.id,
        categoryId: categoryFilter === 'ALL' ? undefined : categoryFilter,
        search: search || undefined,
      });

      if (format === 'csv') {
        const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${type}_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${type}_export_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err: any) {
      alert('Export failed: ' + (err.message || 'Unknown error'));
    }
  };

  const downloadSampleTemplate = () => {
    const csvContent =
      'product_sku,product_name,supplier_part_number,unit_price,currency,lead_time_days,minimum_order_quantity,preferred_supplier\r\n' +
      'PRD-SMT-001,Smart LED Controller v1,VND-LED-01,325.00,INR,7,10,TRUE\r\n' +
      'PRD-ESP-002,ESP32 Wi-Fi Module,ESP32-WROOM-32D,180.50,INR,14,25,FALSE\r\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'supplier_catalogue_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Supplier Management & Sourcing"
        description="Comprehensive supplier directory, multi-product catalog mapping, RFQs, negotiations, and live performance analytics."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => handleExport('suppliers', 'csv')}
              className="flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              Export Directory (CSV)
            </Button>
            {hasPermission('supplier:write') && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setIsCreateRFQOpen(true)}
                  className="flex items-center gap-1.5"
                >
                  <FileText className="w-4 h-4" />
                  Create RFQ
                </Button>
                <Button onClick={() => setIsCreateOpen(true)} className="flex items-center gap-1.5">
                  <Plus className="w-4 h-4" />
                  Register Supplier
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* PHASE 1: Real Database Dashboard Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Total Suppliers</span>
            <Truck className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats?.totalSuppliers ?? 0}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            {stats?.activeSuppliers ?? 0} Active • {stats?.inactiveSuppliers ?? 0} Inactive
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Mapped Catalogue</span>
            <Layers className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats?.totalMappedProducts ?? 0}</div>
          <div className="text-[11px] text-slate-400 mt-1">Component part mappings</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Purchase Orders</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats?.totalPurchaseOrders ?? 0}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            {stats?.completedPurchaseOrders ?? 0} Completed • {stats?.repeatSuppliers ?? 0} Repeat
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Open RFQs</span>
            <FileText className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats?.pendingRFQs ?? 0}</div>
          <div className="text-[11px] text-slate-400 mt-1">Awaiting responses</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Negotiations</span>
            <ArrowRightLeft className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats?.activeNegotiations ?? 0}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            {stats?.pendingQuotations ?? 0} Pending quotes
          </div>
        </div>
      </div>

      {/* PHASE 1: Search & Dynamic Category Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Multi-attribute Search */}
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by supplier name, code, contact, SKU, product name, or category..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>

          {/* Category Filter */}
          <div className="relative">
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none bg-white"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none bg-white"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive</option>
              <option value="BLOCKED">Blocked</option>
            </select>

            {(search || categoryFilter !== 'ALL' || statusFilter !== 'ALL') && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('');
                  setCategoryFilter('ALL');
                  setStatusFilter('ALL');
                  setPage(1);
                }}
                className="whitespace-nowrap px-3 text-xs"
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* PHASE 1 & 2: Supplier Results Cards & Table */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-400">Loading suppliers...</div>
      ) : suppliers.length === 0 ? (
        <EmptyState
          title="No suppliers found"
          description={
            search || categoryFilter !== 'ALL'
              ? 'No suppliers match your current filter and search criteria.'
              : 'Register your first supplier to begin mapping catalogue parts and sourcing.'
          }
          action={
            hasPermission('supplier:write') && (
              <Button onClick={() => setIsCreateOpen(true)}>Register Supplier</Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((supplier) => (
            <div
              key={supplier.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-primary/50 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="font-semibold text-slate-900">{supplier.name}</h3>
                    <div className="text-xs text-slate-500 font-mono">{supplier.supplier_code}</div>
                  </div>
                  <StatusBadge status={supplier.status} />
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 mb-3">
                  {supplier.contact_name && (
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-slate-700">Contact:</span> {supplier.contact_name}
                    </div>
                  )}
                  {supplier.email && (
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Mail className="w-3.5 h-3.5" />
                      <span>{supplier.email}</span>
                    </div>
                  )}
                  {supplier.phone && (
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Phone className="w-3.5 h-3.5" />
                      <span>{supplier.phone}</span>
                    </div>
                  )}
                </div>

                {/* Sourcing Metrics Badges */}
                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-lg text-center mb-3">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-medium">Mapped Parts</div>
                    <div className="text-sm font-semibold text-slate-800">{supplier.mappedProductCount ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-medium">Orders (POs)</div>
                    <div className="text-sm font-semibold text-slate-800">
                      {supplier.historicalPurchaseOrderCount ?? 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-medium">Avg Lead Time</div>
                    <div className="text-sm font-semibold text-slate-800">
                      {supplier.avgLeadTimeDays ? `${supplier.avgLeadTimeDays}d` : 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Mapped Products Preview */}
                {supplier.mappedProducts && supplier.mappedProducts.length > 0 && (
                  <div className="mb-3">
                    <div className="text-[11px] font-medium text-slate-500 mb-1.5">Catalogued Items:</div>
                    <div className="flex flex-wrap gap-1">
                      {supplier.mappedProducts.slice(0, 3).map((p) => (
                        <span
                          key={p.id}
                          className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200"
                        >
                          <span className="font-mono">{p.partNumber}</span>
                          <span className="font-semibold text-primary">₹{p.unitPrice}</span>
                        </span>
                      ))}
                      {supplier.mappedProducts.length > 3 && (
                        <span className="text-[10px] text-slate-400 self-center">
                          +{supplier.mappedProducts.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedSupplier(supplier);
                    setProfileTab('overview');
                  }}
                  className="w-full text-xs"
                >
                  View Profile
                </Button>
                {hasPermission('supplier:write') && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedSupplier(supplier);
                      setProfileTab('products');
                    }}
                    className="w-full text-xs"
                  >
                    Manage Parts
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500 pt-2">
          <div>
            Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, pagination.total)} of {pagination.total} suppliers
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUPPLIER PROFILE DRAWER / FULL VIEW (PHASES 2, 3, 4, 5)                  */}
      {/* ========================================================================= */}
      {selectedSupplier && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-4xl bg-white h-full shadow-2xl flex flex-col">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">{selectedSupplier.name}</h2>
                  <span className="text-xs font-mono px-2 py-0.5 bg-slate-200 text-slate-700 rounded">
                    {selectedSupplier.supplier_code}
                  </span>
                  <StatusBadge status={selectedSupplier.status} />
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Contact: {selectedSupplier.contact_name || 'N/A'} • {selectedSupplier.email || 'No email'}
                </div>
              </div>
              <button
                onClick={() => setSelectedSupplier(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Tabs Navigation */}
            <div className="flex border-b border-slate-200 px-4 bg-white overflow-x-auto text-sm">
              <button
                onClick={() => setProfileTab('overview')}
                className={`py-3 px-3 font-medium border-b-2 whitespace-nowrap transition-colors ${
                  profileTab === 'overview'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setProfileTab('products')}
                className={`py-3 px-3 font-medium border-b-2 whitespace-nowrap transition-colors ${
                  profileTab === 'products'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Products & Parts ({activeSupplierDetail?.products?.length ?? selectedSupplier.mappedProductCount ?? 0})
              </button>
              <button
                onClick={() => setProfileTab('quotations')}
                className={`py-3 px-3 font-medium border-b-2 whitespace-nowrap transition-colors ${
                  profileTab === 'quotations'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Quotations & Bargaining
              </button>
              <button
                onClick={() => setProfileTab('history')}
                className={`py-3 px-3 font-medium border-b-2 whitespace-nowrap transition-colors ${
                  profileTab === 'history'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Purchase History ({activeSupplierDetail?.purchase_orders?.length ?? 0})
              </button>
              <button
                onClick={() => setProfileTab('performance')}
                className={`py-3 px-3 font-medium border-b-2 whitespace-nowrap transition-colors ${
                  profileTab === 'performance'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Performance & Analytics
              </button>
              <button
                onClick={() => setProfileTab('import_export')}
                className={`py-3 px-3 font-medium border-b-2 whitespace-nowrap transition-colors ${
                  profileTab === 'import_export'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Import & Export
              </button>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* TAB 1: OVERVIEW */}
              {profileTab === 'overview' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Contact Details</h4>
                      <div className="space-y-2 text-sm text-slate-800">
                        <div>
                          <span className="text-slate-400 text-xs block">Contact Person</span>
                          {selectedSupplier.contact_name || 'Not provided'}
                        </div>
                        <div>
                          <span className="text-slate-400 text-xs block">Email</span>
                          {selectedSupplier.email || 'Not provided'}
                        </div>
                        <div>
                          <span className="text-slate-400 text-xs block">Phone</span>
                          {selectedSupplier.phone || 'Not provided'}
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Location & Status</h4>
                      <div className="space-y-2 text-sm text-slate-800">
                        <div>
                          <span className="text-slate-400 text-xs block">Address</span>
                          {selectedSupplier.address || 'Not provided'}
                        </div>
                        <div>
                          <span className="text-slate-400 text-xs block">Default Currency</span>
                          <span className="font-semibold text-slate-900">INR (₹)</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-xs block">Registration Date</span>
                          {formatDate(selectedSupplier.created_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: PRODUCTS & PARTS (PHASE 2) */}
              {profileTab === 'products' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-slate-900 text-sm">Mapped Catalogue Products</h4>
                      <p className="text-xs text-slate-500">Manage components and parts supplied by this vendor.</p>
                    </div>
                    {hasPermission('supplier:write') && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setIsBulkMapOpen(true)}>
                          <Layers className="w-3.5 h-3.5 mr-1" />
                          Bulk Map Parts
                        </Button>
                        <Button size="sm" onClick={() => setIsSingleMapOpen(true)}>
                          <PackagePlus className="w-3.5 h-3.5 mr-1" />
                          Map Part
                        </Button>
                      </div>
                    )}
                  </div>

                  {activeSupplierDetail?.products?.length === 0 ? (
                    <EmptyState
                      title="No products mapped yet"
                      description="Map catalogue products to this supplier to track pricing, lead times, and compare sourcing options."
                      action={
                        hasPermission('supplier:write') && (
                          <Button size="sm" onClick={() => setIsSingleMapOpen(true)}>
                            Map First Product
                          </Button>
                        )
                      }
                    />
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-xs text-slate-500 uppercase border-b border-slate-200">
                          <tr>
                            <th className="px-3 py-2.5">Catalogue Part</th>
                            <th className="px-3 py-2.5">Supplier Part #</th>
                            <th className="px-3 py-2.5">Unit Price (₹)</th>
                            <th className="px-3 py-2.5">Lead Time</th>
                            <th className="px-3 py-2.5">MOQ</th>
                            <th className="px-3 py-2.5">Preferred</th>
                            <th className="px-3 py-2.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {activeSupplierDetail?.products?.map((sp: any) => (
                            <tr key={sp.id} className="hover:bg-slate-50">
                              <td className="px-3 py-2.5">
                                <div className="font-medium text-slate-900">{sp.product?.name}</div>
                                <div className="text-xs font-mono text-slate-400">{sp.product?.part_number}</div>
                              </td>
                              <td className="px-3 py-2.5 font-mono text-xs text-slate-600">
                                {sp.supplier_part_number || '—'}
                              </td>
                              <td className="px-3 py-2.5 font-semibold text-slate-900">
                                ₹{Number(sp.unit_price).toFixed(2)}
                              </td>
                              <td className="px-3 py-2.5 text-slate-600">{sp.lead_time_days ?? 7} days</td>
                              <td className="px-3 py-2.5 text-slate-600">{Number(sp.minimum_order_qty)}</td>
                              <td className="px-3 py-2.5">
                                {sp.is_preferred ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                    <Check className="w-3 h-3" /> Preferred
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-400">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => setComparingProductId(sp.product_id)}
                                    title="Compare Sourcing with Other Suppliers"
                                    className="p-1 text-slate-400 hover:text-primary rounded"
                                  >
                                    <ArrowRightLeft className="w-4 h-4" />
                                  </button>
                                  {hasPermission('supplier:write') && (
                                    <>
                                      <button
                                        onClick={() => {
                                          setEditingMapping(sp);
                                          setEditPartNumber(sp.supplier_part_number || '');
                                          setEditUnitPrice(String(Number(sp.unit_price) || 0));
                                          setEditLeadTime(Number(sp.lead_time_days) || 7);
                                          setEditMoq(String(Number(sp.minimum_order_qty) || 1));
                                          setEditIsPreferred(Boolean(sp.is_preferred));
                                        }}
                                        title="Edit Mapping"
                                        className="p-1 text-slate-400 hover:text-blue-600 rounded"
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => {
                                          if (confirm(`Remove mapping for ${sp.product?.part_number}? Historical purchase orders will remain safe.`)) {
                                            removeMappingMutation.mutate({
                                              supplierId: selectedSupplier.id,
                                              productId: sp.product_id,
                                            });
                                          }
                                        }}
                                        title="Remove Mapping"
                                        className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: QUOTATIONS & NEGOTIATIONS (PHASE 4) */}
              {profileTab === 'quotations' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-slate-900 text-sm">Quotations & Active Bargaining</h4>
                      <p className="text-xs text-slate-500">Record quotes, submit counter-offers, and view audit trail.</p>
                    </div>
                    {hasPermission('supplier:write') && (
                      <Button size="sm" onClick={() => setIsQuoteModalOpen(true)}>
                        <DollarSign className="w-3.5 h-3.5 mr-1" />
                        Record Quotation
                      </Button>
                    )}
                  </div>

                  {activeSupplierDetail?.quotations?.length === 0 ? (
                    <EmptyState
                      title="No quotations recorded"
                      description="Receive and log quotations from this vendor against your RFQs or direct requests."
                      action={
                        hasPermission('supplier:write') && (
                          <Button size="sm" onClick={() => setIsQuoteModalOpen(true)}>
                            Record First Quote
                          </Button>
                        )
                      }
                    />
                  ) : (
                    <div className="space-y-3">
                      {activeSupplierDetail?.quotations?.map((q: any) => (
                        <div key={q.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-semibold text-slate-700">{q.quotation_number}</span>
                                {q.rfq && (
                                  <span className="text-[11px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono">
                                    RFQ: {q.rfq.rfq_number}
                                  </span>
                                )}
                                <span
                                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                    q.status === 'ACCEPTED'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : q.status === 'REJECTED'
                                      ? 'bg-rose-100 text-rose-800'
                                      : q.status === 'COUNTER_OFFERED'
                                      ? 'bg-purple-100 text-purple-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {q.status}
                                </span>
                              </div>
                              <div className="text-sm font-medium text-slate-900 mt-1">
                                {q.product?.name} ({q.product?.part_number})
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="text-base font-bold text-slate-900">₹{Number(q.unit_price).toFixed(2)}</div>
                              <div className="text-xs text-slate-500">
                                Total: ₹{Number(q.total_amount).toFixed(2)} (Qty: {Number(q.offered_quantity)})
                              </div>
                            </div>
                          </div>

                          {/* Negotiation Events Timeline */}
                          {q.negotiation_events && q.negotiation_events.length > 0 && (
                            <div className="bg-white rounded-lg p-3 border border-slate-200 text-xs space-y-2">
                              <div className="font-semibold text-slate-700">Negotiation History:</div>
                              {q.negotiation_events.map((ev: any) => (
                                <div key={ev.id} className="flex items-start justify-between border-b border-slate-100 pb-1.5 last:border-0 last:pb-0">
                                  <div>
                                    <span className="font-semibold text-primary">{ev.event_type}</span>: {ev.message}
                                    <div className="text-[10px] text-slate-400">
                                      By {ev.actor?.first_name} {ev.actor?.last_name} on {formatDate(ev.created_at)}
                                    </div>
                                  </div>
                                  <div className="font-mono font-medium text-slate-800">
                                    ₹{Number(ev.counter_price).toFixed(2)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Action Row */}
                          <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                            <span className="text-slate-500">Lead Time: {q.lead_time_days ?? 7} days</span>

                            <div className="flex gap-2">
                              {hasPermission('supplier:write') && q.status !== 'ACCEPTED' && q.status !== 'REJECTED' && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setNegotiatingQuote(q);
                                      setCounterPriceInput(String(q.unit_price));
                                    }}
                                  >
                                    <ArrowRightLeft className="w-3.5 h-3.5 mr-1" />
                                    Bargain / Counter
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      negotiateMutation.mutate({
                                        quoteId: q.id,
                                        eventType: 'ACCEPTED',
                                        counterPrice: Number(q.unit_price),
                                        message: 'Quotation price accepted by procurement',
                                      });
                                    }}
                                    className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                                  >
                                    <Check className="w-3.5 h-3.5 mr-1" />
                                    Accept Quote
                                  </Button>
                                </>
                              )}

                              {q.status === 'ACCEPTED' && !q.converted_po_id && hasPermission('purchasing:write') && (
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    if (confirm('Convert this accepted quote into a Purchase Order? Approver authorization will still be required.')) {
                                      convertToPOMutation.mutate(q.id);
                                    }
                                  }}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                  <TrendingUp className="w-3.5 h-3.5 mr-1" />
                                  Convert to PO
                                </Button>
                              )}

                              {q.converted_po_id && (
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                                  <CheckCircle className="w-3.5 h-3.5" /> Converted to PO
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: PURCHASE HISTORY */}
              {profileTab === 'history' && (
                <div className="space-y-4">
                  <h4 className="font-semibold text-slate-900 text-sm">Purchase Order History</h4>
                  {activeSupplierDetail?.purchase_orders?.length === 0 ? (
                    <EmptyState
                      title="No purchase orders"
                      description="No purchase orders have been issued to this vendor yet."
                    />
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-xs text-slate-500 uppercase border-b border-slate-200">
                          <tr>
                            <th className="px-3 py-2.5">PO Number</th>
                            <th className="px-3 py-2.5">Date</th>
                            <th className="px-3 py-2.5">Status</th>
                            <th className="px-3 py-2.5">Amount (₹)</th>
                            <th className="px-3 py-2.5">Items</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {activeSupplierDetail?.purchase_orders?.map((po: any) => (
                            <tr key={po.id} className="hover:bg-slate-50">
                              <td className="px-3 py-2.5 font-mono text-xs font-semibold text-slate-900">
                                {po.po_number}
                              </td>
                              <td className="px-3 py-2.5 text-xs text-slate-600">{formatDate(po.order_date)}</td>
                              <td className="px-3 py-2.5">
                                <StatusBadge status={po.status} />
                              </td>
                              <td className="px-3 py-2.5 font-semibold text-slate-900">
                                ₹{Number(po.total_amount).toFixed(2)}
                              </td>
                              <td className="px-3 py-2.5 text-xs text-slate-600">
                                {po.lines?.length ?? 0} ordered lines
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: PERFORMANCE & ANALYTICS (PHASE 5) */}
              {profileTab === 'performance' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-slate-900 text-sm">Real Performance Metrics</h4>
                      <p className="text-xs text-slate-500">
                        Derived directly from actual POs, goods receipts, and quality inspection records.
                      </p>
                    </div>
                    {performanceAnalytics && (
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase ${
                          performanceAnalytics.ranking.grade === 'TIER_1_PREFERRED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : performanceAnalytics.ranking.grade === 'TIER_2_QUALIFIED'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {performanceAnalytics.ranking.grade.replace(/_/g, ' ')} ({performanceAnalytics.ranking.score}/100)
                      </span>
                    )}
                  </div>

                  {performanceAnalytics && (
                    <div className="space-y-4">
                      {/* Metric cards */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <div className="text-[11px] text-slate-400">Total Orders</div>
                          <div className="text-xl font-bold text-slate-900">
                            {performanceAnalytics.totalPurchaseOrders}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {performanceAnalytics.completedPurchaseOrders} completed
                          </div>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <div className="text-[11px] text-slate-400">Repeat Orders</div>
                          <div className="text-xl font-bold text-slate-900">
                            {performanceAnalytics.repeatPurchaseOrders}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Frequency: {(performanceAnalytics.repeatPurchaseFrequency * 100).toFixed(0)}%
                          </div>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <div className="text-[11px] text-slate-400">On-Time Delivery</div>
                          <div className="text-xl font-bold text-emerald-700">
                            {performanceAnalytics.onTimeDeliveryPercentage !== null
                              ? `${performanceAnalytics.onTimeDeliveryPercentage}%`
                              : 'Not Available'}
                          </div>
                          <div className="text-[10px] text-slate-500">Actual receipt dates</div>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <div className="text-[11px] text-slate-400">Quality Rejection</div>
                          <div className="text-xl font-bold text-rose-600">
                            {performanceAnalytics.qualityRejectionPercentage !== null
                              ? `${performanceAnalytics.qualityRejectionPercentage}%`
                              : 'Not Available'}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {performanceAnalytics.rejectedQuantity} of {performanceAnalytics.inspectedQuantity} units
                          </div>
                        </div>
                      </div>

                      {/* Transparent Scoring Rationale */}
                      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
                        <h5 className="font-semibold text-slate-800 text-xs uppercase tracking-wide">
                          Score Breakdown & Rationale:
                        </h5>
                        <ul className="text-xs text-slate-600 space-y-1">
                          {performanceAnalytics.ranking.reasons.map((reason, idx) => (
                            <li key={idx} className="flex items-center gap-1.5">
                              <CheckCircle className="w-3.5 h-3.5 text-primary" />
                              <span>{reason}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 6: IMPORT & EXPORT (PHASE 3) */}
              {profileTab === 'import_export' && (
                <div className="space-y-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <h4 className="font-semibold text-slate-900 text-sm">Catalogue Spreadsheet Import</h4>
                    <p className="text-xs text-slate-600">
                      Upload an Excel or CSV catalogue to map multiple products with prices, lead times, and MOQs.
                    </p>

                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={downloadSampleTemplate}>
                        <Download className="w-3.5 h-3.5 mr-1" />
                        Download Template (.CSV)
                      </Button>
                      {hasPermission('supplier:write') && (
                        <Button size="sm" onClick={() => setIsImportOpen(true)}>
                          <Upload className="w-3.5 h-3.5 mr-1" />
                          Launch Import Wizard
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <h4 className="font-semibold text-slate-900 text-sm">Export Supplier Data</h4>
                    <p className="text-xs text-slate-600">Download formatted CSV or JSON reports for this vendor.</p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleExport('mappings', 'csv')}>
                        Export Mappings (CSV)
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleExport('purchase_orders', 'csv')}>
                        Export PO History (CSV)
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleExport('price_comparison', 'csv')}>
                        Export Price Matrix (CSV)
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SINGLE PRODUCT MAPPING (PHASE 2)                                  */}
      {/* ========================================================================= */}
      {isSingleMapOpen && selectedSupplier && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-semibold text-slate-900">Map Part to {selectedSupplier.name}</h3>
              <button onClick={() => setIsSingleMapOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                addProductMutation.mutate({
                  productId: mapProductId,
                  supplierPartNumber: mapPartNumber || null,
                  unitPrice: parseFloat(mapUnitPrice),
                  currency: 'INR',
                  leadTimeDays: mapLeadTime,
                  minimumOrderQty: parseFloat(mapMoq),
                  isPreferred: mapIsPreferred,
                });
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block font-medium text-slate-700 mb-1">Catalog Part *</label>
                <select
                  required
                  value={mapProductId}
                  onChange={(e) => setMapProductId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                >
                  <option value="">Select a catalogue product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.part_number} — {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Supplier Part #</label>
                  <input
                    type="text"
                    value={mapPartNumber}
                    onChange={(e) => setMapPartNumber(e.target.value)}
                    placeholder="e.g. VND-PART-01"
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Lead Time (Days)</label>
                  <input
                    type="number"
                    min="1"
                    value={mapLeadTime}
                    onChange={(e) => setMapLeadTime(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Unit Price (₹ INR) *</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    required
                    value={mapUnitPrice}
                    onChange={(e) => setMapUnitPrice(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Min Order Qty</label>
                  <input
                    type="number"
                    min="1"
                    value={mapMoq}
                    onChange={(e) => setMapMoq(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="pref-check"
                  checked={mapIsPreferred}
                  onChange={(e) => setMapIsPreferred(e.target.checked)}
                  className="rounded border-slate-300 text-primary focus:ring-primary"
                />
                <label htmlFor="pref-check" className="text-slate-700">
                  Preferred Supplier for this component
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="outline" onClick={() => setIsSingleMapOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={addProductMutation.isPending}>
                  {addProductMutation.isPending ? 'Mapping...' : 'Add Mapping'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT PRODUCT MAPPING                                               */}
      {/* ========================================================================= */}
      {editingMapping && selectedSupplier && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-semibold text-slate-900">Edit Mapping</h3>
                <p className="text-xs text-slate-500">
                  {editingMapping.product?.part_number} — {editingMapping.product?.name}
                </p>
              </div>
              <button onClick={() => setEditingMapping(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateMappingMutation.mutate({
                  supplierId: selectedSupplier.id,
                  productId: editingMapping.product_id,
                  payload: {
                    supplierPartNumber: editPartNumber || null,
                    unitPrice: parseFloat(editUnitPrice),
                    currency: 'INR',
                    leadTimeDays: editLeadTime,
                    minimumOrderQty: parseFloat(editMoq),
                    isPreferred: editIsPreferred,
                  },
                });
              }}
              className="space-y-3 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Supplier Part #</label>
                  <input
                    type="text"
                    value={editPartNumber}
                    onChange={(e) => setEditPartNumber(e.target.value)}
                    placeholder="e.g. VND-PART-01"
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Lead Time (Days)</label>
                  <input
                    type="number"
                    min="1"
                    value={editLeadTime}
                    onChange={(e) => setEditLeadTime(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Unit Price (₹ INR) *</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    required
                    value={editUnitPrice}
                    onChange={(e) => setEditUnitPrice(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Min Order Qty</label>
                  <input
                    type="number"
                    min="1"
                    value={editMoq}
                    onChange={(e) => setEditMoq(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="edit-pref-check"
                  checked={editIsPreferred}
                  onChange={(e) => setEditIsPreferred(e.target.checked)}
                  className="rounded border-slate-300 text-primary focus:ring-primary"
                />
                <label htmlFor="edit-pref-check" className="text-slate-700">
                  Preferred Supplier for this component
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="outline" onClick={() => setEditingMapping(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMappingMutation.isPending}>
                  {updateMappingMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: BULK PRODUCT MAPPING (PHASE 2)                                    */}
      {/* ========================================================================= */}
      {isBulkMapOpen && selectedSupplier && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-semibold text-slate-900">Bulk Map Products</h3>
                <p className="text-xs text-slate-500">Select multiple catalog items to map in a single batch.</p>
              </div>
              <button onClick={() => setIsBulkMapOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-lg text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Batch Unit Price (₹)</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={bulkUnitPrice}
                  onChange={(e) => setBulkUnitPrice(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Lead Time (Days)</label>
                <input
                  type="number"
                  min="1"
                  value={bulkLeadTime}
                  onChange={(e) => setBulkLeadTime(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Default MOQ</label>
                <input
                  type="number"
                  min="1"
                  value={bulkMoq}
                  onChange={(e) => setBulkMoq(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded"
                />
              </div>
            </div>

            {/* Product selection list */}
            <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 text-xs">
              {products.map((p) => {
                const isSelected = !!selectedBulkProductIds[p.id];
                return (
                  <div
                    key={p.id}
                    onClick={() =>
                      setSelectedBulkProductIds((prev) => ({
                        ...prev,
                        [p.id]: !prev[p.id],
                      }))
                    }
                    className={`p-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-50 ${
                      isSelected ? 'bg-primary/5 font-medium' : ''
                    }`}
                  >
                    <div>
                      <div className="text-slate-900 font-medium">{p.name}</div>
                      <div className="text-slate-400 font-mono text-[11px]">{p.part_number}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="rounded border-slate-300 text-primary"
                    />
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-xs text-slate-500">
                {Object.values(selectedBulkProductIds).filter(Boolean).length} products selected
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsBulkMapOpen(false)}>
                  Cancel
                </Button>
                <Button
                  disabled={
                    bulkMapMutation.isPending ||
                    Object.values(selectedBulkProductIds).filter(Boolean).length === 0
                  }
                  onClick={() => {
                    const mappings = Object.keys(selectedBulkProductIds)
                      .filter((pId) => selectedBulkProductIds[pId])
                      .map((pId) => ({
                        productId: pId,
                        unitPrice: parseFloat(bulkUnitPrice),
                        currency: 'INR',
                        leadTimeDays: bulkLeadTime,
                        minimumOrderQty: parseFloat(bulkMoq),
                        isPreferred: false,
                        status: 'ACTIVE',
                      }));
                    bulkMapMutation.mutate(mappings);
                  }}
                >
                  {bulkMapMutation.isPending ? 'Mapping...' : 'Commit Bulk Mapping'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SOURCING COMPARISON MATRIX (PHASE 2 & 4)                           */}
      {/* ========================================================================= */}
      {comparingProductId && comparisonData && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-semibold text-slate-900">
                  Supplier Price Comparison: {comparisonData.product.part_number}
                </h3>
                <p className="text-xs text-slate-500">{comparisonData.product.name}</p>
              </div>
              <button onClick={() => setComparingProductId(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {comparisonData.suppliers.length === 0 ? (
              <EmptyState
                title="No suppliers mapped"
                description="This catalogue product is not mapped to any suppliers yet."
              />
            ) : (
              <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Supplier</th>
                      <th className="p-2.5">Part #</th>
                      <th className="p-2.5">Unit Price</th>
                      <th className="p-2.5">Lead Time</th>
                      <th className="p-2.5">MOQ</th>
                      <th className="p-2.5">Preferred</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {comparisonData.suppliers.map((s, idx) => (
                      <tr key={s.supplierId} className={idx === 0 ? 'bg-emerald-50/50 font-medium' : ''}>
                        <td className="p-2.5">
                          <div className="text-slate-900">{s.supplierName}</div>
                          <div className="text-[10px] font-mono text-slate-400">{s.supplierCode}</div>
                        </td>
                        <td className="p-2.5 font-mono">{s.supplierPartNumber || '—'}</td>
                        <td className="p-2.5 font-bold text-slate-900">
                          ₹{s.unitPrice.toFixed(2)}{' '}
                          {idx === 0 && <span className="text-[10px] text-emerald-700">(Best Price)</span>}
                        </td>
                        <td className="p-2.5">{s.leadTimeDays} days</td>
                        <td className="p-2.5">{s.minimumOrderQty}</td>
                        <td className="p-2.5">
                          {s.isPreferred ? (
                            <span className="text-emerald-700 font-semibold">✓ Yes</span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setComparingProductId(null)}>
                Close Matrix
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SPREADSHEET IMPORT WIZARD (PHASE 3)                               */}
      {/* ========================================================================= */}
      {isImportOpen && selectedSupplier && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-semibold text-slate-900">Import Catalogue: {selectedSupplier.name}</h3>
                <p className="text-xs text-slate-500">Upload CSV or Excel file to map catalogue parts.</p>
              </div>
              <button
                onClick={() => {
                  setIsImportOpen(false);
                  setImportPreviewData(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step 1: File Uploader */}
            {!importPreviewData && (
              <div className="space-y-4 text-center py-8 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                <FileSpreadsheet className="w-12 h-12 text-primary mx-auto" />
                <div>
                  <label className="cursor-pointer bg-primary text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-primary/90">
                    Select .CSV File
                    <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                  </label>
                  <div className="text-[11px] text-slate-400 mt-2">
                    Must include headers: product_sku, unit_price, lead_time_days, minimum_order_quantity
                  </div>
                </div>
                {importError && <div className="text-xs text-rose-600">{importError}</div>}
              </div>
            )}

            {/* Step 2: Import Validation Preview */}
            {importPreviewData && (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg text-xs">
                  <div>
                    Total Rows: <span className="font-semibold">{importPreviewData.totalRows}</span> • Valid:{' '}
                    <span className="font-semibold text-emerald-600">{importPreviewData.validCount}</span> • Errors:{' '}
                    <span className="font-semibold text-rose-600">{importPreviewData.errorCount}</span>
                  </div>
                  {importPreviewData.errorCount > 0 && (
                    <span className="text-[11px] text-rose-600">Rows with errors will be skipped</span>
                  )}
                </div>

                <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b text-slate-500">
                      <tr>
                        <th className="p-2">Row</th>
                        <th className="p-2">SKU</th>
                        <th className="p-2">Part Name</th>
                        <th className="p-2">Price (₹)</th>
                        <th className="p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {importPreviewData.rows.map((row: any) => (
                        <tr key={row.rowNumber} className={row.isValid ? '' : 'bg-rose-50/50'}>
                          <td className="p-2 font-mono">{row.rowNumber}</td>
                          <td className="p-2 font-mono font-medium">{row.sku}</td>
                          <td className="p-2">{row.productName}</td>
                          <td className="p-2 font-semibold">₹{row.unitPrice}</td>
                          <td className="p-2">
                            {row.isValid ? (
                              <span className="text-emerald-600 font-semibold">Ready</span>
                            ) : (
                              <span className="text-rose-600">{row.errors.join('; ')}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setImportPreviewData(null);
                      setImportRows([]);
                    }}
                  >
                    Upload Another File
                  </Button>
                  <Button
                    disabled={commitImportMutation.isPending || importPreviewData.validCount === 0}
                    onClick={() => {
                      const validRows = importPreviewData.rows.filter((r: any) => r.isValid);
                      commitImportMutation.mutate(validRows);
                    }}
                  >
                    {commitImportMutation.isPending ? 'Committing...' : `Commit ${importPreviewData.validCount} Mappings`}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE RFQ (PHASE 4)                                              */}
      {/* ========================================================================= */}
      {isCreateRFQOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-semibold text-slate-900">Create Request for Quotation (RFQ)</h3>
                <p className="text-xs text-slate-500">Invite suppliers to submit formal competitive quotes.</p>
              </div>
              <button onClick={() => setIsCreateRFQOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (rfqSelectedSuppliers.length === 0) {
                  alert('Please select at least one supplier to invite.');
                  return;
                }
                const validItems = rfqItems.filter((i) => !!i.productId);
                if (validItems.length === 0) {
                  alert('Please add at least one catalog part to the RFQ.');
                  return;
                }

                createRFQMutation.mutate({
                  title: rfqTitle,
                  deadlineDate: rfqDeadlineDate ? new Date(rfqDeadlineDate).toISOString() : null,
                  deliveryDate: rfqDeliveryDate ? new Date(rfqDeliveryDate).toISOString() : null,
                  notes: rfqNotes,
                  supplierIds: rfqSelectedSuppliers,
                  items: validItems,
                });
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block font-medium text-slate-700 mb-1">RFQ Title *</label>
                <input
                  type="text"
                  required
                  value={rfqTitle}
                  onChange={(e) => setRfqTitle(e.target.value)}
                  placeholder="e.g. SMT Controllers Q4 Batch RFQ"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Quotation Deadline</label>
                  <input
                    type="date"
                    value={rfqDeadlineDate}
                    onChange={(e) => setRfqDeadlineDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Target Delivery Date</label>
                  <input
                    type="date"
                    value={rfqDeliveryDate}
                    onChange={(e) => setRfqDeliveryDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              {/* Select Suppliers to Invite */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">Invite Suppliers *</label>
                <div className="max-h-28 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
                  {suppliers.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={rfqSelectedSuppliers.includes(s.id)}
                        onChange={(e) => {
                          if (e.target.checked) setRfqSelectedSuppliers((prev) => [...prev, s.id]);
                          else setRfqSelectedSuppliers((prev) => prev.filter((id) => id !== s.id));
                        }}
                        className="rounded border-slate-300 text-primary"
                      />
                      <span>
                        {s.name} ({s.supplier_code})
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Add RFQ Items */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-medium text-slate-700">Requested Parts *</label>
                  <button
                    type="button"
                    onClick={() => setRfqItems((prev) => [...prev, { productId: '', quantityRequired: 1, notes: '' }])}
                    className="text-primary hover:underline font-semibold"
                  >
                    + Add Part
                  </button>
                </div>
                <div className="space-y-2 max-h-36 overflow-y-auto">
                  {rfqItems.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center bg-slate-50 p-2 rounded-lg border">
                      <select
                        required
                        value={item.productId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRfqItems((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, productId: val } : it))
                          );
                        }}
                        className="flex-1 px-2 py-1 text-xs border rounded bg-white"
                      >
                        <option value="">Select part...</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.part_number} — {p.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        required
                        placeholder="Qty"
                        value={item.quantityRequired}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setRfqItems((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, quantityRequired: val } : it))
                          );
                        }}
                        className="w-20 px-2 py-1 text-xs border rounded"
                      />
                      {rfqItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setRfqItems((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="outline" onClick={() => setIsCreateRFQOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createRFQMutation.isPending}>
                  {createRFQMutation.isPending ? 'Publishing...' : 'Publish RFQ'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RECORD SUPPLIER QUOTATION (PHASE 4)                               */}
      {/* ========================================================================= */}
      {isQuoteModalOpen && selectedSupplier && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-semibold text-slate-900">Record Quotation: {selectedSupplier.name}</h3>
              <button onClick={() => setIsQuoteModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createQuotationMutation.mutate({
                  supplierId: selectedSupplier.id,
                  productId: quoteProductId,
                  unitPrice: parseFloat(quoteUnitPrice),
                  offeredQuantity: parseFloat(quoteQty),
                  taxAmount: parseFloat(quoteTax),
                  shippingAmount: parseFloat(quoteShipping),
                  leadTimeDays: quoteLeadTime,
                  minimumOrderQuantity: parseFloat(quoteMoq),
                  currency: 'INR',
                  termsConditions: quoteTerms,
                });
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block font-medium text-slate-700 mb-1">Catalog Part *</label>
                <select
                  required
                  value={quoteProductId}
                  onChange={(e) => setQuoteProductId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                >
                  <option value="">Select part...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.part_number} — {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Unit Price (₹ INR) *</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    required
                    value={quoteUnitPrice}
                    onChange={(e) => setQuoteUnitPrice(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Quantity Quoted</label>
                  <input
                    type="number"
                    min="1"
                    value={quoteQty}
                    onChange={(e) => setQuoteQty(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Taxes (₹)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={quoteTax}
                    onChange={(e) => setQuoteTax(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Shipping Charges (₹)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={quoteShipping}
                    onChange={(e) => setQuoteShipping(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="outline" onClick={() => setIsQuoteModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createQuotationMutation.isPending}>
                  {createQuotationMutation.isPending ? 'Recording...' : 'Record Quote'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: BARGAINING & COUNTER-OFFER (PHASE 4)                              */}
      {/* ========================================================================= */}
      {negotiatingQuote && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-semibold text-slate-900">Bargaining & Counter-Offer</h3>
                <p className="text-xs text-slate-500">Quotation: {negotiatingQuote.quotation_number}</p>
              </div>
              <button onClick={() => setNegotiatingQuote(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg text-xs space-y-1">
              <div>
                Original Quoted Price: <span className="font-bold">₹{Number(negotiatingQuote.unit_price).toFixed(2)}</span>
              </div>
              <div>Component: {negotiatingQuote.product?.name}</div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Counter-Offer Price (₹ INR) *</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  required
                  value={counterPriceInput}
                  onChange={(e) => setCounterPriceInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Negotiation Reason / Message *</label>
                <textarea
                  rows={3}
                  required
                  value={negotiationMsgInput}
                  onChange={(e) => setNegotiationMsgInput(e.target.value)}
                  placeholder="e.g. Requesting volume discount for bulk procurement of 100+ units."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button variant="outline" onClick={() => setNegotiatingQuote(null)}>
                  Cancel
                </Button>
                <Button
                  disabled={negotiateMutation.isPending || !negotiationMsgInput}
                  onClick={() => {
                    negotiateMutation.mutate({
                      quoteId: negotiatingQuote.id,
                      eventType: 'COUNTER_OFFER',
                      counterPrice: parseFloat(counterPriceInput),
                      message: negotiationMsgInput,
                    });
                  }}
                >
                  {negotiateMutation.isPending ? 'Sending...' : 'Send Counter-Offer'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE SUPPLIER                                                   */}
      {/* ========================================================================= */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-semibold text-slate-900">Register New Supplier</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && <div className="p-3 text-xs bg-rose-50 text-rose-700 rounded-lg">{formError}</div>}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createSupplierMutation.mutate({
                  name,
                  contactName: contactName || undefined,
                  email: email || undefined,
                  phone: phone || undefined,
                  address: address || undefined,
                  rating,
                });
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block font-medium text-slate-700 mb-1">Company / Supplier Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Apex Electronics Ltd"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Office / Warehouse Address</label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createSupplierMutation.isPending}>
                  {createSupplierMutation.isPending ? 'Registering...' : 'Register Supplier'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
