import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ECNService } from '../../services';
import { PageHeader, EmptyState } from '../../components/ui/Cards';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badges';
import { Bell, Search, ArrowRight, CheckCircle2, Clock, Calendar, ExternalLink } from 'lucide-react';
import { formatDate } from '../../lib/utils';
import { Link } from 'react-router-dom';

export function ECNList() {
  const [statusFilter, setStatusFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: ecnsData, isLoading } = useQuery({
    queryKey: ['ecns', statusFilter, departmentFilter, searchTerm],
    queryFn: () =>
      ECNService.listECNs(1, 100, {
        status: statusFilter || undefined,
        department: departmentFilter || undefined,
        search: searchTerm || undefined,
      }),
  });

  const ecns = ecnsData?.data || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Engineering Change Notices (ECN)"
        description="Formal multi-department communication of released engineering changes, material dispositions, and acknowledgement sign-offs."
      />

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search ECN #, title, ECO #..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="text-xs pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg w-56 focus:outline-none focus:ring-1 focus:ring-primary focus:bg-white"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs font-medium px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="ISSUED">Issued</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Department Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">Department:</span>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="text-xs font-medium px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Departments</option>
              <option value="ENGINEERING">Engineering</option>
              <option value="QUALITY">Quality</option>
              <option value="PRODUCTION">Production</option>
              <option value="PROCUREMENT">Procurement</option>
              <option value="INVENTORY">Inventory</option>
              <option value="MANAGEMENT">Management</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main ECN Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading change notices...</div>
        ) : ecns.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No change notices found"
            description="When an Engineering Change Order (ECO) is approved and released, generate an ECN to formally notify operating departments."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">ECN #</th>
                  <th className="py-3 px-4">Title & Change Description</th>
                  <th className="py-3 px-4">Source ECO</th>
                  <th className="py-3 px-4">Product / Part</th>
                  <th className="py-3 px-4">Effective Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Acknowledgements</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ecns.map((ecn) => {
                  const dists = ecn.distributions || [];
                  const ackCount = dists.filter((d: any) => d.acknowledgement_status === 'ACKNOWLEDGED').length;
                  const totalDists = dists.length;
                  const isComplete = totalDists > 0 && ackCount === totalDists;

                  return (
                    <tr key={ecn.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {ecn.ecn_number}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-800 max-w-xs">
                        <div className="truncate font-semibold">{ecn.title}</div>
                        <div className="text-[11px] text-slate-400 truncate">{ecn.change_summary}</div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {ecn.eco ? (
                          <Link
                            to={`/ecos/${ecn.eco.id}`}
                            className="font-mono text-primary hover:underline flex items-center gap-1 font-semibold"
                          >
                            <span>{ecn.eco.eco_number}</span>
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-700 whitespace-nowrap">
                        {ecn.eco?.product?.part_number || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formatDate(ecn.effective_date)}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <StatusBadge status={ecn.status} />
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {totalDists > 0 ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                              isComplete
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {isComplete ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Clock className="w-3 h-3 text-amber-500" />
                            )}
                            <span>
                              {ackCount} / {totalDists} Ack
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <Link
                          to={`/ecns/${ecn.id}`}
                          className="font-semibold text-primary hover:text-primary-hover hover:underline inline-flex items-center gap-1"
                        >
                          <span>Workspace</span>
                          <ArrowRight className="w-3 h-3" />
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

