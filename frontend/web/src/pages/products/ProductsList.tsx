import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProductService } from '../../services';
import { PageHeader, EmptyState } from '../../components/ui/Cards';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badges';
import { Box, Plus, Search, Tag, X } from 'lucide-react';
import { formatDate } from '../../lib/utils';
import { Link } from 'react-router-dom';

export function ProductsList() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);

  // Form states
  const [partNumber, setPartNumber] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [catName, setCatName] = useState('');
  const [catCode, setCatCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products', search],
    queryFn: () => ProductService.listProducts(1, 50, search || undefined),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => ProductService.listCategories(),
  });

  const createProductMutation = useMutation({
    mutationFn: ProductService.createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsCreateOpen(false);
      setPartNumber('');
      setName('');
      setDescription('');
      setCategoryId('');
    },
    onError: (err: any) => {
      setError(err.response?.data?.error?.message || 'Failed to create product');
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: ProductService.createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setIsCategoryOpen(false);
      setCatName('');
      setCatCode('');
    },
    onError: (err: any) => {
      setError(err.response?.data?.error?.message || 'Failed to create category');
    },
  });

  const products = productsData?.data || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products & Engineering Catalog"
        description="Master product records, revisions, and release lifecycles."
      >
        <Button variant="outline" size="sm" onClick={() => setIsCategoryOpen(true)}>
          <Tag className="w-4 h-4 mr-1.5" />
          <span>New Category</span>
        </Button>
        <Button size="sm" onClick={() => setIsCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" />
          <span>New Product</span>
        </Button>
      </PageHeader>

      <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search products by part number or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading catalog items...</div>
        ) : products.length === 0 ? (
          <EmptyState
            icon={Box}
            title="No products found"
            description="Create your first manufactured product or adjust search filters."
            action={
              <Button size="sm" onClick={() => setIsCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-1.5" />
                <span>Create Product</span>
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Part Number</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-center">Version</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-900">
                      {product.part_number}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-800">
                      {product.name}
                      {product.description && (
                        <div className="text-[11px] text-slate-400 truncate max-w-xs">{product.description}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {product.category?.name || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-block px-2 py-0.5 rounded bg-slate-100 font-mono text-[11px] font-semibold text-slate-700">
                        v{product.current_version}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={product.status} />
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">{formatDate(product.created_at)}</td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        to={`/products/${product.id}`}
                        className="font-semibold text-primary hover:text-primary-hover hover:underline"
                      >
                        Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Product Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Create New Product</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                createProductMutation.mutate({
                  partNumber,
                  name,
                  description,
                  categoryId,
                });
              }}
              className="space-y-4 mt-4"
            >
              {error && <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">{error}</div>}

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700">Part Number</label>
                <input
                  type="text"
                  required
                  placeholder="PRD-1002"
                  value={partNumber}
                  onChange={(e) => setPartNumber(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700">Product Name</label>
                <input
                  type="text"
                  required
                  placeholder="Main Logic Controller"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700">Category</label>
                <select
                  required
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select a category...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700">Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Primary hardware component description..."
                  className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <Button variant="outline" size="sm" type="button" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit" isLoading={createProductMutation.isPending}>
                  Create Product
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Category Modal */}
      {isCategoryOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Add Product Category</h3>
              <button onClick={() => setIsCategoryOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                createCategoryMutation.mutate({
                  name: catName,
                  code: catCode,
                });
              }}
              className="space-y-4 mt-4"
            >
              {error && <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">{error}</div>}

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700">Category Name</label>
                <input
                  type="text"
                  required
                  placeholder="Power Modules"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700">Category Code</label>
                <input
                  type="text"
                  required
                  placeholder="PWR"
                  value={catCode}
                  onChange={(e) => setCatCode(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <Button variant="outline" size="sm" type="button" onClick={() => setIsCategoryOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit" isLoading={createCategoryMutation.isPending}>
                  Add Category
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
