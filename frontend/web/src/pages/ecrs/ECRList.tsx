import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ECRService, ProductService, BOMService } from '../../services';
import { PageHeader, EmptyState } from '../../components/ui/Cards';
import { Button } from '../../components/ui/Button';
import { StatusBadge, PriorityBadge, RequestTypeBadge } from '../../components/ui/Badges';
import { ClipboardList, Plus, X, Search, FileText, ArrowRight, AlertTriangle, Paperclip } from 'lucide-react';
import { formatDate } from '../../lib/utils';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function ECRList() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Filters state
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [myRequestsOnly, setMyRequestsOnly] = useState(false);

  // Submit Modal state
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [requestType, setRequestType] = useState('DEFECT');
  const [priority, setPriority] = useState('MEDIUM');
  const [productId, setProductId] = useState('');
  const [bomId, setBomId] = useState('');
  const [affectedPartNumber, setAffectedPartNumber] = useState('');
  const [suggestedSolution, setSuggestedSolution] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Queries
  const { data: ecrsData, isLoading } = useQuery({
    queryKey: ['ecrs', statusFilter, typeFilter, priorityFilter, searchTerm, myRequestsOnly],
    queryFn: () =>
      ECRService.listECRs(1, 100, {
        status: statusFilter || undefined,
        requestType: typeFilter || undefined,
        priority: priorityFilter || undefined,
        search: searchTerm || undefined,
        myRequests: myRequestsOnly || undefined,
      }),
  });

  const { data: productsData } = useQuery({
    queryKey: ['products', 'ecr-select'],
    queryFn: () => ProductService.listProducts(1, 100),
    enabled: isSubmitOpen,
  });

  const { data: bomsData } = useQuery({
    queryKey: ['boms', 'ecr-select'],
    queryFn: () => BOMService.listBOMs(1, 100),
    enabled: isSubmitOpen,
  });

  const ecrs = ecrsData?.data || [];
  const products = productsData?.data || [];
  const allBoms = bomsData?.data || [];
  const availableBoms = productId ? allBoms.filter((b: any) => b.product_id === productId) : allBoms;

  // Submit Mutation
  const createEcrMutation = useMutation({
    mutationFn: (payload: any) => ECRService.createECR(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ecrs'] });
      setIsSubmitOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setError(err.response?.data?.error?.message || 'Failed to submit change request');
    },
  });

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setRequestType('DEFECT');
    setPriority('MEDIUM');
    setProductId('');
    setBomId('');
    setAffectedPartNumber('');
    setSuggestedSolution('');
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim() || title.length < 3) {
      setError('Title must be at least 3 characters');
      return;
    }
    if (!description.trim() || description.length < 10) {
      setError('Description must be at least 10 characters');
      return;
    }

    createEcrMutation.mutate({
      title: title.trim(),
      description: description.trim(),
      requestType,
      priority,
      productId: productId || null,
      bomId: bomId || null,
      affectedPartNumber: affectedPartNumber.trim() || null,
      suggestedSolution: suggestedSolution.trim() || null,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Engineering Change Requests (ECR)"
        description="Employee-driven issue reporting, manufacturing defect reviews, and change suggestion promotion."
      >
        <Button size="sm" onClick={() => setIsSubmitOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" />
          <span>Submit Request</span>
        </Button>
      </PageHeader>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search title, ECR #, part..."
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
              <option value="SUBMITTED">Submitted</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="NEEDS_INFORMATION">Needs Information</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="REJECTED">Rejected</option>
              <option value="PROMOTED">Promoted</option>
            </select>
          </div>

          {/* Request Type Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="text-xs font-medium px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Types</option>
              <option value="DEFECT">Defect</option>
              <option value="IMPROVEMENT">Improvement</option>
              <option value="COST_REDUCTION">Cost Reduction</option>
              <option value="SAFETY">Safety</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="text-xs font-medium px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
        </div>

        {/* My Requests Filter Toggle */}
        <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={myRequestsOnly}
            onChange={(e) => setMyRequestsOnly(e.target.checked)}
            className="rounded border-slate-300 text-primary focus:ring-primary"
          />
          <span>My Requests Only</span>
        </label>
      </div>

      {/* Main ECR Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading change requests...</div>
        ) : ecrs.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No change requests found"
            description="Submit a change request to notify the engineering team of manufacturing defects or improvement suggestions."
            action={
              <Button size="sm" onClick={() => setIsSubmitOpen(true)}>
                <Plus className="w-4 h-4 mr-1.5" />
                <span>Submit Request</span>
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">ECR #</th>
                  <th className="py-3 px-4">Title & Problem Description</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Product / Part</th>
                  <th className="py-3 px-4">Workflow Status</th>
                  <th className="py-3 px-4">Submitter</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ecrs.map((ecr) => (
                  <tr key={ecr.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {ecr.ecr_number}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-800 max-w-xs">
                      <div className="truncate font-semibold">{ecr.title}</div>
                      <div className="text-[11px] text-slate-400 truncate">{ecr.description}</div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <RequestTypeBadge type={ecr.request_type} />
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <PriorityBadge priority={ecr.priority} />
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-700 whitespace-nowrap">
                      {ecr.product?.part_number || ecr.affected_part_number || '—'}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <StatusBadge status={ecr.status} />
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                      {ecr.submitter ? `${ecr.submitter.first_name} ${ecr.submitter.last_name}` : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">{formatDate(ecr.submitted_at)}</td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <Link
                        to={`/ecrs/${ecr.id}`}
                        className="font-semibold text-primary hover:text-primary-hover hover:underline inline-flex items-center gap-1"
                      >
                        <span>Workspace</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Submit ECR Modal */}
      {isSubmitOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold text-slate-900">Submit Engineering Change Request</h3>
              </div>
              <button
                onClick={() => {
                  setIsSubmitOpen(false);
                  resetForm();
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                  Request Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chassis bracket bolt clearance interference in Station 4"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>

              {/* Type and Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                    Request Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={requestType}
                    onChange={(e) => setRequestType(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                  >
                    <option value="DEFECT">Defect / Flaw</option>
                    <option value="IMPROVEMENT">Product Improvement</option>
                    <option value="COST_REDUCTION">Cost Reduction</option>
                    <option value="SAFETY">Safety Issue</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                    Severity / Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
              </div>

              {/* Related Product and BOM */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                    Related Product (Optional)
                  </label>
                  <select
                    value={productId}
                    onChange={(e) => {
                      setProductId(e.target.value);
                      setBomId('');
                    }}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                  >
                    <option value="">None / Not Product Specific</option>
                    {products.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.part_number} — {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                    Related BOM (Optional)
                  </label>
                  <select
                    value={bomId}
                    onChange={(e) => setBomId(e.target.value)}
                    disabled={availableBoms.length === 0}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary bg-white disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <option value="">None / General</option>
                    {availableBoms.map((b: any) => (
                      <option key={b.id} value={b.id}>
                        {b.bom_number} (v{b.current_version})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Affected Part Number */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                  Affected Component / Part Number (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. BRKT-MNT-402"
                  value={affectedPartNumber}
                  onChange={(e) => setAffectedPartNumber(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                  Problem Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Detailed explanation of the issue encountered on the line, defect symptoms, or rationale for change..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>

              {/* Suggested Solution */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                  Suggested Solution / Fix (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Proposed engineering alteration, tolerance adjustment, or vendor substitution..."
                  value={suggestedSolution}
                  onChange={(e) => setSuggestedSolution(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Global Upload Restriction Notice */}
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
                <div className="flex items-center gap-2 font-semibold">
                  <Paperclip className="w-3.5 h-3.5 text-amber-600" />
                  <span>Attachments Restricted (Coming Soon)</span>
                </div>
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  Direct photo and CAD file attachments are temporarily restricted by system policy. Please document
                  all critical part numbers, measurements, and symptoms textually in the description.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsSubmitOpen(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createEcrMutation.isPending}>
                  {createEcrMutation.isPending ? 'Submitting...' : 'Confirm Submission'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
