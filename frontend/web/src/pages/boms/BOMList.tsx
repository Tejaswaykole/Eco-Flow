import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BOMService } from '../../services';
import { PageHeader, EmptyState } from '../../components/ui/Cards';
import { StatusBadge } from '../../components/ui/Badges';
import { Layers, ArrowRight, DollarSign } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDate, formatCurrency } from '../../lib/utils';
import { BOM } from '../../types';

export function BOMList() {
  const { data: bomsResponse, isLoading } = useQuery({
    queryKey: ['boms', 'list'],
    queryFn: () => BOMService.listBOMs(1, 100),
  });

  const boms: BOM[] = (bomsResponse?.data as any) || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bills of Materials (BOM) Registry"
        description="Select a manufactured Bill of Materials to review components, live costing, and engineering impact notes."
      />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading BOM assembly registry...</div>
        ) : boms.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No Bills of Materials found"
            description="Go to a product in the catalog and click 'Create BOM' to initialize one."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">BOM Number</th>
                  <th className="py-3 px-4">Product Part & Name</th>
                  <th className="py-3 px-4 text-center">Version</th>
                  <th className="py-3 px-4 text-center">Ingredients / Items</th>
                  <th className="py-3 px-4 text-right">Total Est. Cost</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {boms.map((bom) => {
                  const compCount = bom.components?.length || 0;
                  const totalCost = (bom.components || []).reduce(
                    (sum, c) => sum + Number(c.total_cost || 0),
                    0
                  );

                  return (
                    <tr key={bom.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {bom.bom_number}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">
                          {bom.product?.part_number || 'N/A'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {bom.product?.name || 'Standard Assembly'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono">
                        v{bom.current_version}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                          {compCount} ingredients / items
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(totalCost)}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={bom.status} />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          to={`/boms/${bom.id}`}
                          className="inline-flex items-center gap-1 font-semibold text-primary hover:text-primary-hover hover:underline"
                        >
                          <span>Open BOM Workspace</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
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
  );
}

