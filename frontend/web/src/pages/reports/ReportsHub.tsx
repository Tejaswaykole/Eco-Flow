import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ReportsService } from '../../services';
import { PageHeader, StatCard, EmptyState } from '../../components/ui/Cards';
import { Button } from '../../components/ui/Button';
import {
  Download,
  FileSpreadsheet,
  Layers,
  Archive,
  ShoppingCart,
  Factory,
  ShieldCheck,
  AlertTriangle,
  IndianRupee,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { formatDate } from '../../lib/utils';
import { apiClient } from '../../lib/api';

export function ReportsHub() {
  const [activeTab, setActiveTab] = useState<'ENGINEERING' | 'INVENTORY' | 'PURCHASING' | 'MANUFACTURING' | 'QUALITY'>('ENGINEERING');
  const [exporting, setExporting] = useState(false);

  const { data: engData, isLoading: loadingEng } = useQuery({
    queryKey: ['reports', 'engineering'],
    queryFn: () => ReportsService.getEngineeringReport(),
    enabled: activeTab === 'ENGINEERING',
  });

  const { data: invData, isLoading: loadingInv } = useQuery({
    queryKey: ['reports', 'inventory'],
    queryFn: () => ReportsService.getInventoryReport(),
    enabled: activeTab === 'INVENTORY',
  });

  const { data: poData, isLoading: loadingPO } = useQuery({
    queryKey: ['reports', 'purchasing'],
    queryFn: () => ReportsService.getPurchasingReport(),
    enabled: activeTab === 'PURCHASING',
  });

  const { data: mfgData, isLoading: loadingMfg } = useQuery({
    queryKey: ['reports', 'manufacturing'],
    queryFn: () => ReportsService.getManufacturingReport(),
    enabled: activeTab === 'MANUFACTURING',
  });

  const { data: qualData, isLoading: loadingQual } = useQuery({
    queryKey: ['reports', 'quality'],
    queryFn: () => ReportsService.getQualityReport(),
    enabled: activeTab === 'QUALITY',
  });

  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const type = activeTab.toLowerCase();
      const response = await apiClient.get(`/reports/export?type=${type}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ecoflow_${type}_report_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert('Failed to download CSV export');
    } finally {
      setExporting(false);
    }
  };

  const tabs = [
    { key: 'ENGINEERING', label: 'Engineering & BOMs', icon: Layers },
    { key: 'INVENTORY', label: 'Inventory & Stock Valuation', icon: Archive },
    { key: 'PURCHASING', label: 'Purchasing & Supplier Spend', icon: ShoppingCart },
    { key: 'MANUFACTURING', label: 'Manufacturing & Work Orders', icon: Factory },
    { key: 'QUALITY', label: 'Quality & Non-Conformances', icon: ShieldCheck },
  ];

  const formatINR = (val?: string | number) => {
    if (val === undefined || val === null) return '₹0.00';
    const num = typeof val === 'number' ? val : parseFloat(val);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(num);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports, Analytics & Exports"
        description="Comprehensive engineering costing, inventory valuation, supplier spend, and manufacturing metrics in INR."
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportCSV}
            disabled={exporting}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            <span>{exporting ? 'Generating CSV...' : `Export ${activeTab} CSV`}</span>
          </Button>
        }
      />

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === tab.key
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab 1: Engineering */}
      {activeTab === 'ENGINEERING' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <StatCard
              title="Total BOM Formulations"
              value={loadingEng ? '...' : engData?.boms?.length ?? 0}
              description="Active bills of materials"
              icon={Layers}
            />
            <StatCard
              title="ECR Avg Turnaround"
              value={loadingEng ? '...' : `${engData?.ecrStats?.avgTurnaroundDays ?? '0.0'} days`}
              description="Decision cycle time"
              icon={Clock}
            />
            <StatCard
              title="Total Change Orders"
              value={loadingEng ? '...' : engData?.ecoStats?.total ?? 0}
              description="Formal ECO revisions"
              icon={CheckCircle2}
            />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 font-bold text-sm text-slate-900">
              BOM Cost Rollup Summary (INR)
            </div>
            {loadingEng ? (
              <div className="p-8 text-center text-xs text-slate-500">Loading BOM costing report...</div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">BOM #</th>
                    <th className="py-3 px-4">Part Number</th>
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-4 text-center">Components</th>
                    <th className="py-3 px-4 text-right">Rolled Up Cost (INR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {engData?.boms?.map((b: any) => (
                    <tr key={b.id} className="hover:bg-slate-50/70">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{b.bomNumber}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-700">{b.productPartNumber}</td>
                      <td className="py-3.5 px-4 text-slate-800">{b.productName}</td>
                      <td className="py-3.5 px-4 text-center font-mono">{b.componentCount}</td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                        {formatINR(b.totalCostINR)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Inventory */}
      {activeTab === 'INVENTORY' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <StatCard
              title="Warehouses Managed"
              value={loadingInv ? '...' : invData?.warehouses?.length ?? 0}
              description="Physical inventory hubs"
              icon={Archive}
            />
            <StatCard
              title="Low Stock Critical Alerts"
              value={loadingInv ? '...' : invData?.lowStockItems?.length ?? 0}
              description="Stock at or below reorder threshold"
              icon={AlertTriangle}
            />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 font-bold text-sm text-slate-900">
              Warehouse Valuation Breakdown (INR)
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Warehouse Code</th>
                  <th className="py-3 px-4">Warehouse Name</th>
                  <th className="py-3 px-4 text-center">Items Stocked</th>
                  <th className="py-3 px-4 text-right">Total Valuation (INR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invData?.warehouses?.map((w: any) => (
                  <tr key={w.id} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{w.code}</td>
                    <td className="py-3.5 px-4 text-slate-800">{w.name}</td>
                    <td className="py-3.5 px-4 text-center font-mono">{w.itemCount}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700">
                      {formatINR(w.totalValuationINR)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {invData?.lowStockItems?.length > 0 && (
            <div className="bg-white rounded-xl border border-rose-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-rose-100 bg-rose-50/40 font-bold text-sm text-rose-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Critical Low Stock Items Requiring Reorder</span>
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Part Number</th>
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-4">Warehouse</th>
                    <th className="py-3 px-4 text-center">Qty on Hand</th>
                    <th className="py-3 px-4 text-center">Min Threshold</th>
                    <th className="py-3 px-4 text-center">UOM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invData?.lowStockItems?.map((i: any) => (
                    <tr key={i.id} className="hover:bg-rose-50/20">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{i.partNumber}</td>
                      <td className="py-3.5 px-4 text-slate-800">{i.productName}</td>
                      <td className="py-3.5 px-4 text-slate-600">{i.warehouse}</td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-rose-600">
                        {parseFloat(i.quantityOnHand).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-slate-600">
                        {parseFloat(i.minThreshold).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-center text-slate-600">{i.unitOfMeasure}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Purchasing */}
      {activeTab === 'PURCHASING' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <StatCard
              title="Total Purchase Orders"
              value={loadingPO ? '...' : poData?.totalOrders ?? 0}
              description="All recorded procurement orders"
              icon={ShoppingCart}
            />
            <StatCard
              title="Suppliers"
              value={loadingPO ? '...' : poData?.supplierSpend?.length ?? 0}
              description="Active vendor network"
              icon={IndianRupee}
            />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 font-bold text-sm text-slate-900">
              Supplier Spend Analysis (INR)
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Supplier Code</th>
                  <th className="py-3 px-4">Supplier Name</th>
                  <th className="py-3 px-4 text-center">Orders Placed</th>
                  <th className="py-3 px-4 text-right">Total Spend (INR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {poData?.supplierSpend?.map((s: any) => (
                  <tr key={s.id} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{s.code}</td>
                    <td className="py-3.5 px-4 text-slate-800">{s.name}</td>
                    <td className="py-3.5 px-4 text-center font-mono">{s.orderCount}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                      {formatINR(s.totalSpendINR)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Manufacturing */}
      {activeTab === 'MANUFACTURING' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
            <StatCard
              title="Work Orders"
              value={loadingMfg ? '...' : mfgData?.totalWorkOrders ?? 0}
              description="Total production jobs"
              icon={Factory}
            />
            <StatCard
              title="Target Qty Planned"
              value={loadingMfg ? '...' : parseFloat(mfgData?.quantities?.totalPlanned || '0').toFixed(0)}
              description="Aggregate target units"
              icon={Layers}
            />
            <StatCard
              title="Completed Units"
              value={loadingMfg ? '...' : parseFloat(mfgData?.quantities?.totalCompleted || '0').toFixed(0)}
              description="Finished goods made"
              icon={CheckCircle2}
            />
            <StatCard
              title="Production Scrap Rate"
              value={loadingMfg ? '...' : `${mfgData?.quantities?.scrapRatePercent || '0.00'}%`}
              description="Rejected vs total output"
              icon={AlertTriangle}
            />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 font-bold text-sm text-slate-900">
              Work Order Execution Details
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">WO #</th>
                  <th className="py-3 px-4">Part #</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Target Qty</th>
                  <th className="py-3 px-4 text-center">Completed</th>
                  <th className="py-3 px-4 text-center">Rejected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mfgData?.workOrders?.map((wo: any) => (
                  <tr key={wo.id} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{wo.woNumber}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-700">{wo.productPartNumber}</td>
                    <td className="py-3.5 px-4 text-slate-800">{wo.productName}</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {wo.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono">{parseFloat(wo.targetQty).toFixed(2)}</td>
                    <td className="py-3.5 px-4 text-center font-mono text-emerald-600 font-bold">
                      {parseFloat(wo.completedQty).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-rose-600">
                      {parseFloat(wo.rejectedQty).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Quality */}
      {activeTab === 'QUALITY' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
            <StatCard
              title="Inspections Completed"
              value={loadingQual ? '...' : qualData?.inspections?.total ?? 0}
              description="Receiving & in-process tests"
              icon={ShieldCheck}
            />
            <StatCard
              title="First Pass Yield"
              value={loadingQual ? '...' : `${qualData?.inspections?.passRatePercent ?? '100.00'}%`}
              description="Inspection pass rate"
              icon={CheckCircle2}
            />
            <StatCard
              title="Total NCRs Logged"
              value={loadingQual ? '...' : qualData?.ncrs?.total ?? 0}
              description="Non-conformances recorded"
              icon={AlertTriangle}
            />
            <StatCard
              title="Active CAPA Plans"
              value={loadingQual ? '...' : qualData?.ncrs?.capaPlansDefined ?? 0}
              description="Corrective action workflows"
              icon={Clock}
            />
          </div>
        </div>
      )}
    </div>
  );
}

