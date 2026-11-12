import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { ProductService, BOMService } from '../../services';
import { PageHeader, EmptyState } from '../../components/ui/Cards';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badges';
import { useAuth } from '../../context/AuthContext';
import {
  Layers,
  ArrowRight,
  Plus,
  Search,
  Filter,
  X,
  Box,
  CheckCircle,
  Clock,
  Archive,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { formatDate } from '../../lib/utils';
import { Product, ProductCategory, BOM } from '../../types';

export function BOMList() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { hasPermission, user } = useAuth();

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [bomNumber, setBomNumber] = useState('');
  const [bomDescription, setBomDescription] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  // 1. Fetch categories for category filter dropdown
  const { data: categories = [] } = useQuery<ProductCategory[]>({
    queryKey: ['categories'],
    queryFn: () => ProductService.listCategories(),
  });

  // 2. Fetch products with search and category filtering
  const {
    data: productsResponse,
    isLoading: isProductsLoading,
    isError: isProductsError,
    error: productsError,
  } = useQuery({
    queryKey: ['products', 'bom-registry', page, search, selectedCategoryId],
    queryFn: () =>
      ProductService.listProducts(page, pageSize, search || undefined, selectedCategoryId || undefined),
  });

  const products: Product[] = (productsResponse?.data as any) || [];
  const meta = productsResponse?.meta;

  // Quick stats
  const totalProducts = meta?.total ?? products.length;
  const productsWithBOM = useMemo(() => {
    return products.filter((p) => p.boms && p.boms.length > 0).length;
  }, [products]);
  const productsWithoutBOM = useMemo(() => {
    return products.filter((p) => !p.boms || p.boms.length === 0).length;
  }, [products]);

  // Can the current user create a BOM?
  const canCreateBOM = hasPermission('bom:write');

  // Mutation to create BOM
  const createBOMMutation = useMutation({
    mutationFn: BOMService.createBOM,
    onSuccess: (newBom: BOM) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['boms'] });
      setIsCreateModalOpen(false);
      setSelectedProduct(null);
      setBomNumber('');
      setBomDescription('');
      setModalError(null);
      if (newBom?.id) {
        navigate(`/boms/${newBom.id}`);
      }
    },
    onError: (err: any) => {
      setModalError(err.response?.data?.error?.message || err.message || 'Failed to create Bill of Materials');
    },
  });

  // Open modal with specific product preselected
  const handleOpenCreateModal = (product?: Product) => {
    setModalError(null);
    if (product) {
      setSelectedProduct(product);
      setBomNumber(`BOM-${product.part_number}`);
    } else {
      // Find first product without BOM as default if available
      const firstWithout = products.find((p) => !p.boms || p.boms.length === 0);
      const defaultProd = firstWithout || products[0] || null;
      setSelectedProduct(defaultProd);
      setBomNumber(defaultProd ? `BOM-${defaultProd.part_number}` : '');
    }
    setBomDescription('');
    setIsCreateModalOpen(true);
  };

  const handleSelectProductChange = (prodId: string) => {
    const found = products.find((p) => p.id === prodId) || null;
    setSelectedProduct(found);
    if (found) {
      setBomNumber(`BOM-${found.part_number}`);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    if (!selectedProduct) {
      setModalError('Please select a valid product.');
      return;
    }
    if (!bomNumber.trim()) {
      setModalError('BOM Number is required.');
      return;
    }

    createBOMMutation.mutate({
      productId: selectedProduct.id,
      bomNumber: bomNumber.trim(),
      description: bomDescription.trim() || undefined,
    });
  };

  const handleClearFilters = () => {
    setSearch('');
    setSelectedCategoryId('');
    setPage(1);
  };

  const hasActiveFilters = Boolean(search || selectedCategoryId);

  return (
    <div className="space-y-6">
      {/* A. Header */}
      <PageHeader
        title="BOM Registry"
        description="Manage product bills of materials, discover engineering structures, and initialize new assemblies."
      >
        {canCreateBOM && (
          <Button
            size="sm"
            onClick={() => handleOpenCreateModal()}
            className="shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            <span>Create BOM</span>
          </Button>
        )}
      </PageHeader>

      {/* Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Products</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{totalProducts}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Box className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">With Active BOM</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">{productsWithBOM}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Awaiting BOM</div>
            <div className="text-2xl font-bold text-amber-600 mt-1">{productsWithoutBOM}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* C & D. Search & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search by product name, SKU, or part number..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category Dropdown Filter */}
          <div className="flex items-center gap-2">
            <div className="relative min-w-[200px]">
              <select
                value={selectedCategoryId}
                onChange={(e) => {
                  setSelectedCategoryId(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-slate-700 font-medium"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} ({cat.code})
                  </option>
                ))}
              </select>
            </div>

            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearFilters}
                className="text-slate-600 hover:text-slate-900 border-dashed"
                title="Clear all active filters"
              >
                <X className="w-3.5 h-3.5 mr-1" />
                <span>Clear</span>
              </Button>
            )}
          </div>
        </div>

        {/* Filter Summary Tags */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 pt-1 text-xs text-slate-500">
            <span>Filtering by:</span>
            {search && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">
                Query: "{search}"
                <button onClick={() => setSearch('')} className="hover:text-rose-500">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedCategoryId && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                Category: {categories.find((c) => c.id === selectedCategoryId)?.name || 'Selected'}
                <button onClick={() => setSelectedCategoryId('')} className="hover:text-rose-500">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* B. Product Discovery & BOM Action Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isProductsLoading ? (
          <div className="p-12 text-center text-sm text-slate-500 flex flex-col items-center justify-center gap-2">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span>Discovering products and BOM configurations...</span>
          </div>
        ) : isProductsError ? (
          <div className="p-8 text-center text-sm text-rose-600 bg-rose-50/50">
            <AlertCircle className="w-6 h-6 mx-auto mb-2 text-rose-500" />
            <p className="font-semibold">Failed to load product discovery list.</p>
            <p className="text-xs text-slate-500 mt-1">
              {(productsError as any)?.response?.data?.error?.message || (productsError as any)?.message || 'An error occurred'}
            </p>
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            icon={hasActiveFilters ? Filter : Box}
            title={hasActiveFilters ? 'No products match your filters' : 'No products found'}
            description={
              hasActiveFilters
                ? 'Try adjusting your search keywords or selecting "All Categories" to see available catalog products.'
                : 'Create your first product in the engineering catalog before building Bills of Materials.'
            }
            action={
              hasActiveFilters ? (
                <Button variant="outline" size="sm" onClick={handleClearFilters}>
                  Clear Filters
                </Button>
              ) : hasPermission('product:write') ? (
                <Link to="/products">
                  <Button size="sm">
                    <Plus className="w-4 h-4 mr-1.5" />
                    <span>Go to Products Catalog</span>
                  </Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Product Name & Part #</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-center">Product Status</th>
                  <th className="py-3 px-4">BOM Status</th>
                  <th className="py-3 px-4 text-center">BOM Version / Rev</th>
                  <th className="py-3 px-4 text-right">Available Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((product) => {
                  const hasBOM = product.boms && product.boms.length > 0;
                  const primaryBOM = hasBOM ? product.boms![0] : null;

                  return (
                    <tr key={product.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Product Name & Part Number */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{product.part_number}</span>
                          <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-normal">
                            v{product.current_version}
                          </span>
                        </div>
                        <div className="text-slate-700 font-medium mt-0.5">{product.name}</div>
                        {product.description && (
                          <div className="text-[11px] text-slate-400 truncate max-w-sm mt-0.5">
                            {product.description}
                          </div>
                        )}
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {product.category?.name || 'Uncategorized'}
                        </span>
                      </td>

                      {/* Product Status */}
                      <td className="py-3.5 px-4 text-center">
                        <StatusBadge status={product.status} />
                      </td>

                      {/* BOM Status */}
                      <td className="py-3.5 px-4">
                        {hasBOM ? (
                          <div className="space-y-1">
                            {product.boms!.map((b) => (
                              <div key={b.id} className="flex items-center gap-1.5">
                                <span className="font-mono font-semibold text-slate-800 text-[11px]">
                                  {b.bom_number}
                                </span>
                                <StatusBadge status={b.status} />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-400 italic text-[11px]">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                            <span>No BOM Created</span>
                          </span>
                        )}
                      </td>

                      {/* BOM Version or Revision */}
                      <td className="py-3.5 px-4 text-center font-mono">
                        {hasBOM ? (
                          <div className="space-y-1">
                            {product.boms!.map((b) => (
                              <div key={b.id} className="font-bold text-slate-800">
                                v{b.current_version}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-300 font-normal">—</span>
                        )}
                      </td>

                      {/* Available Actions */}
                      <td className="py-3.5 px-4 text-right">
                        {hasBOM ? (
                          <div className="inline-flex items-center gap-2">
                            {/* View / Open BOM */}
                            <Link
                              to={`/boms/${primaryBOM!.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-primary bg-primary/5 hover:bg-primary/10 rounded-lg border border-primary/20 transition-colors"
                            >
                              <span>View BOM</span>
                              <ArrowRight className="w-3 h-3" />
                            </Link>

                            {/* If user can write BOMs and wants to inspect product details */}
                            <Link
                              to={`/products/${product.id}`}
                              className="px-2 py-1 text-xs font-medium text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
                              title="Product Specifications"
                            >
                              Product
                            </Link>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-2">
                            {canCreateBOM ? (
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => handleOpenCreateModal(product)}
                                className="font-semibold text-xs shadow-sm bg-emerald-600 hover:bg-emerald-700"
                              >
                                <Plus className="w-3.5 h-3.5 mr-1" />
                                <span>Create BOM</span>
                              </Button>
                            ) : (
                              <span
                                className="text-[11px] text-slate-400 italic px-2 py-1 bg-slate-50 rounded border border-slate-200"
                                title="Your role has read-only access to Bills of Materials"
                              >
                                Read-Only Access
                              </span>
                            )}

                            <Link
                              to={`/products/${product.id}`}
                              className="px-2 py-1 text-xs font-medium text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                              Product
                            </Link>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination bar if needed */}
        {meta && (meta.pages ?? 1) > 1 && (
          <div className="p-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 bg-slate-50">
            <div>
              Showing page <span className="font-semibold text-slate-800">{meta.page ?? 1}</span> of{' '}
              <span className="font-semibold text-slate-800">{meta.pages ?? 1}</span> ({meta.total ?? products.length} products)
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={(meta.page ?? 1) <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={(meta.page ?? 1) >= (meta.pages ?? 1)}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* 2. Direct BOM Creation Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Create Bill of Materials</h3>
                  <p className="text-xs text-slate-500">Initialize a new engineering BOM for manufacturing</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4 mt-4">
              {modalError && (
                <div className="text-xs text-rose-600 bg-rose-50 p-3 rounded-lg border border-rose-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Product Selection / Preselected Product */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 tracking-wider">
                  Target Product <span className="text-rose-500">*</span>
                </label>
                {selectedProduct ? (
                  <div className="mt-1 p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="font-mono font-bold text-xs text-slate-900">
                        {selectedProduct.part_number}
                      </div>
                      <div className="text-xs text-slate-700 font-medium">{selectedProduct.name}</div>
                      <div className="text-[11px] text-slate-500">
                        Category: {selectedProduct.category?.name || 'Uncategorized'} · Status:{' '}
                        {selectedProduct.status}
                      </div>
                    </div>
                    {/* Allow changing product if needed */}
                    <button
                      type="button"
                      onClick={() => setSelectedProduct(null)}
                      className="text-xs font-semibold text-primary hover:underline ml-2"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <select
                    value=""
                    onChange={(e) => handleSelectProductChange(e.target.value)}
                    required
                    className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="" disabled>
                      Select a product from the catalog...
                    </option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.part_number} — {p.name} {p.boms && p.boms.length > 0 ? '(Has Existing BOM)' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* BOM Number */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 tracking-wider">
                  BOM Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BOM-PRD-001"
                  value={bomNumber}
                  onChange={(e) => setBomNumber(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-[11px] text-slate-400 mt-1">Unique identifier for this bill of materials.</p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 tracking-wider">
                  Description / Assembly Notes
                </label>
                <textarea
                  rows={3}
                  value={bomDescription}
                  onChange={(e) => setBomDescription(e.target.value)}
                  placeholder="Manufacturing BOM assembly notes, initial configuration details..."
                  className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  type="submit"
                  isLoading={createBOMMutation.isPending}
                  disabled={!selectedProduct || !bomNumber.trim()}
                >
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
