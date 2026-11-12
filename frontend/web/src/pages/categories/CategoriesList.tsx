import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProductService } from '../../services';
import { PageHeader, EmptyState } from '../../components/ui/Cards';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badges';
import { Tag, Plus, X, Search, Edit2, Layers, ArrowRight } from 'lucide-react';
import { formatDate } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';

export function CategoriesList() {
  const queryClient = useQueryClient();
  const { user, hasPermission, hasRole } = useAuth();
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => ProductService.listCategories(),
  });

  const createCategoryMutation = useMutation({
    mutationFn: ProductService.createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setIsCreateOpen(false);
      setName('');
      setCode('');
      setDescription('');
    },
    onError: (err: any) => {
      setError(err.response?.data?.error?.message || 'Failed to create category');
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: (payload: { id: string; name: string; description?: string }) =>
      ProductService.updateCategory(payload.id, {
        name: payload.name,
        description: payload.description,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setEditingCategory(null);
      setEditName('');
      setEditDescription('');
    },
    onError: (err: any) => {
      setError(err.response?.data?.error?.message || 'Failed to update category');
    },
  });

  const canCreate = hasPermission('product:write') || hasRole('LEAD_ENGINEER') || hasRole('ADMINISTRATOR');

  const canEdit = (cat: any) => {
    if (!user) return false;
    if (hasRole('ADMINISTRATOR')) return true;
    return (hasPermission('product:write') || hasRole('LEAD_ENGINEER')) && (cat.created_by === user.id || hasRole('LEAD_ENGINEER'));
  };

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product Categories"
        description="Standardized classification taxonomy for manufactured parts and component assemblies."
      >
        {canCreate && (
          <Button size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            <span>New Category</span>
          </Button>
        )}
      </PageHeader>

      <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search categories by name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading product categories...</div>
        ) : filteredCategories.length === 0 ? (
          <EmptyState
            icon={Tag}
            title="No categories found"
            description="Create categories to organize and group manufactured components."
            action={
              canCreate ? (
                <Button size="sm" onClick={() => setIsCreateOpen(true)}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  <span>Create Category</span>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Category Name</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-center">Associated BOMs</th>
                  <th className="py-3 px-4">Author / Owner</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCategories.map((cat) => {
                  const categoryBoms = (cat.products || []).flatMap((p: any) =>
                    (p.boms || []).map((b: any) => ({ ...b, product: p }))
                  );

                  return (
                    <tr key={cat.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        <span className="px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-primary font-bold">
                          {cat.code}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-900 text-sm">{cat.name}</td>
                      <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate">
                        {cat.description || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {categoryBoms.length === 0 ? (
                          <span className="text-[11px] text-slate-400">0 BOMs</span>
                        ) : (
                          <div className="flex flex-wrap items-center justify-center gap-1.5">
                            {categoryBoms.map((b: any) => (
                              <Link
                                key={b.id}
                                to={`/boms/${b.id}`}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 transition-colors"
                                title={`Open ${b.bom_number}`}
                              >
                                <Layers className="w-3 h-3 text-teal-600" />
                                <span>{b.bom_number}</span>
                              </Link>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-medium">
                        {cat.creator ? `${cat.creator.first_name} ${cat.creator.last_name}` : 'System'}
                        {cat.created_by === user?.id && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] bg-teal-50 text-teal-700 border border-teal-200 font-semibold">
                            You
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">{formatDate(cat.created_at)}</td>
                      <td className="py-3.5 px-4 text-right">
                        {canEdit(cat) ? (
                          <button
                            onClick={() => {
                              setEditingCategory(cat);
                              setEditName(cat.name);
                              setEditDescription(cat.description || '');
                              setError(null);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 text-xs font-semibold transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Read-only</span>
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

      {/* Create Category Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Create Product Category</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                createCategoryMutation.mutate({
                  name,
                  code,
                  description,
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
                  placeholder="Mechanical Hardware"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700">Category Code</label>
                <input
                  type="text"
                  required
                  placeholder="MECH-HW"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700">Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Fasteners, chassis, brackets, and structural elements..."
                  className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <Button variant="outline" size="sm" type="button" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit" isLoading={createCategoryMutation.isPending}>
                  Create Category
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Category Modal */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Edit Category</h3>
                <span className="text-xs text-slate-400 font-mono">Code: {editingCategory.code}</span>
              </div>
              <button onClick={() => setEditingCategory(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                updateCategoryMutation.mutate({
                  id: editingCategory.id,
                  name: editName,
                  description: editDescription,
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
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700">Description</label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <Button variant="outline" size="sm" type="button" onClick={() => setEditingCategory(null)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit" isLoading={updateCategoryMutation.isPending}>
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

