import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ProductService } from '../../services';
import { PageHeader, EmptyState } from '../../components/ui/Cards';
import { StatusBadge } from '../../components/ui/Badges';
import { Layers } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDate } from '../../lib/utils';

export function BOMList() {
  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products', 'boms'],
    queryFn: () => ProductService.listProducts(1, 100),
  });

  const products = productsData?.data || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bills of Materials (BOM) Registry"
        description="Select a manufactured product part to view and manage its assembly BOM tree."
      />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading catalog BOM references...</div>
        ) : products.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No product BOMs found"
            description="Create a product in the catalog before initializing its BOM."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Part Number</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-center">Version</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{p.part_number}</td>
                    <td className="py-3.5 px-4 font-medium text-slate-800">{p.name}</td>
                    <td className="py-3.5 px-4 text-slate-600">{p.category?.name || '—'}</td>
                    <td className="py-3.5 px-4 text-center font-mono">v{p.current_version}</td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        to={`/products/${p.id}`}
                        className="font-semibold text-primary hover:text-primary-hover hover:underline"
                      >
                        Open BOM
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

