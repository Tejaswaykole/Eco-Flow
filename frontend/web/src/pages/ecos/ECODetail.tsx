import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ECOService } from '../../services';
import { PageHeader, EmptyState } from '../../components/ui/Cards';
import { Button } from '../../components/ui/Button';
import { StatusBadge, PriorityBadge } from '../../components/ui/Badges';
import { useAuth } from '../../context/AuthContext';
import {
  GitPullRequest,
  CheckCircle,
  XCircle,
  RotateCcw,
  Plus,
  Send,
  ArrowLeft,
  X,
  FileCheck2,
} from 'lucide-react';
import { formatDate } from '../../lib/utils';

export function ECODetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { hasPermission, hasRole } = useAuth();

  // Change Modal State
  const [isChangeModalOpen, setIsChangeModalOpen] = useState(false);
  const [changeType, setChangeType] = useState('QUANTITY_CHANGE');
  const [changeTarget, setChangeTarget] = useState('COMPONENT');
  const [fieldName, setFieldName] = useState('');
  const [oldValue, setOldValue] = useState('');
  const [newValue, setNewValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Review Modal State
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED'>('APPROVED');
  const [comments, setComments] = useState('');
  const [overrideReason, setOverrideReason] = useState('');

  const { data: eco, isLoading } = useQuery({
    queryKey: ['eco', id],
    queryFn: () => ECOService.getECO(id!),
    enabled: !!id,
  });

  const addChangeMutation = useMutation({
    mutationFn: (payload: any) => ECOService.addChange(id!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eco', id] });
      setIsChangeModalOpen(false);
      setFieldName('');
      setOldValue('');
      setNewValue('');
    },
    onError: (err: any) => {
      setError(err.response?.data?.error?.message || 'Failed to record revision change item');
    },
  });

  const submitEcoMutation = useMutation({
    mutationFn: () => ECOService.submitECO(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eco', id] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.error?.message || 'Failed to submit ECO for review');
    },
  });

  const reviewEcoMutation = useMutation({
    mutationFn: (payload: any) => ECOService.reviewECO(id!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eco', id] });
      setIsReviewModalOpen(false);
      setComments('');
      setOverrideReason('');
    },
    onError: (err: any) => {
      setError(err.response?.data?.error?.message || 'Review signoff failed');
    },
  });

  if (isLoading) {
    return <div className="p-8 text-center text-sm text-slate-500">Loading ECO workspace...</div>;
  }

  if (!eco) {
    return <div className="p-8 text-center text-sm text-slate-500">Engineering change order not found.</div>;
  }

  const isDraft = eco.status === 'DRAFT';
  const isReviewable = eco.status === 'SUBMITTED' || eco.status === 'UNDER_REVIEW';
  const canReview = hasPermission('eco:approve') || hasRole('APPROVER') || hasRole('ADMINISTRATOR');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link to="/ecos" className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Change Orders</span>
        </Link>
      </div>

      <PageHeader
        title={`${eco.eco_number} — ${eco.title}`}
        description={eco.description || 'Engineering change proposal specification.'}
      >
        <PriorityBadge priority={eco.priority} />
        <StatusBadge status={eco.status} />

        {isDraft && (
          <>
            <Button variant="outline" size="sm" onClick={() => setIsChangeModalOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              <span>Add Change Item</span>
            </Button>
            <Button size="sm" onClick={() => submitEcoMutation.mutate()} isLoading={submitEcoMutation.isPending}>
              <Send className="w-4 h-4 mr-1.5" />
              <span>Submit for Review</span>
            </Button>
          </>
        )}

        {isReviewable && canReview && (
          <Button size="sm" onClick={() => setIsReviewModalOpen(true)}>
            <FileCheck2 className="w-4 h-4 mr-1.5" />
            <span>Signoff / Review</span>
          </Button>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Target Product</span>
          <span className="text-sm font-bold text-slate-900 font-mono mt-1 block">
            {eco.product?.part_number || 'N/A'} (v{eco.product?.current_version})
          </span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Active Revision</span>
          <span className="text-sm font-bold text-slate-900 mt-1 block">Revision {eco.active_revision_no}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Change Items</span>
          <span className="text-sm font-bold text-slate-900 mt-1 block">{eco.eco_changes?.length || 0} Modifications</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Last Updated</span>
          <span className="text-sm text-slate-600 mt-1 block">{formatDate(eco.updated_at)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Change Items Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Recorded Revision Changes</h3>
              <span className="text-xs text-slate-400">Locked on submission</span>
            </div>

            {(!eco.eco_changes || eco.eco_changes.length === 0) ? (
              <EmptyState
                icon={GitPullRequest}
                title="No change items recorded"
                description={isDraft ? 'Record parameter diffs, quantity changes, or BOM component adjustments.' : 'No changes were logged for this revision.'}
                action={
                  isDraft ? (
                    <Button size="sm" onClick={() => setIsChangeModalOpen(true)}>
                      <Plus className="w-4 h-4 mr-1.5" />
                      <span>Add Change Item</span>
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-100">
                    <tr>
                      <th className="py-3 px-4">Target</th>
                      <th className="py-3 px-4">Change Type</th>
                      <th className="py-3 px-4">Field / Component</th>
                      <th className="py-3 px-4">Original Value</th>
                      <th className="py-3 px-4">New Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {eco.eco_changes.map((ch) => (
                      <tr key={ch.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-700">{ch.change_target}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[10px] text-slate-700 font-semibold">
                            {ch.change_type}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-slate-900">{ch.field_name}</td>
                        <td className="py-3 px-4 text-slate-500 font-mono">{ch.old_value || '—'}</td>
                        <td className="py-3 px-4 text-emerald-700 font-mono font-semibold">{ch.new_value || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Approvals and Revision Trail */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">
              Signoff & Review Decisions
            </h3>

            {(!eco.approvals || eco.approvals.length === 0) ? (
              <div className="text-xs text-slate-400 text-center py-6">
                No formal review decision logged for active revision.
              </div>
            ) : (
              <div className="space-y-4">
                {eco.approvals.map((appr) => (
                  <div key={appr.id} className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">
                        {appr.approver ? `${appr.approver.first_name} ${appr.approver.last_name}` : 'Reviewer'}
                      </span>
                      <StatusBadge status={appr.decision} />
                    </div>
                    {appr.comments && <p className="text-slate-600 italic">"{appr.comments}"</p>}
                    <span className="text-[10px] text-slate-400 block">{formatDate(appr.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Change Modal */}
      {isChangeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Record Revision Change Item</h3>
              <button onClick={() => setIsChangeModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                addChangeMutation.mutate({
                  changeType,
                  changeTarget,
                  fieldName,
                  oldValue,
                  newValue,
                });
              }}
              className="space-y-4 mt-4"
            >
              {error && <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">{error}</div>}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700">Target Entity</label>
                  <select
                    value={changeTarget}
                    onChange={(e) => setChangeTarget(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="COMPONENT">COMPONENT</option>
                    <option value="BOM">BOM</option>
                    <option value="PRODUCT">PRODUCT</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700">Change Type</label>
                  <select
                    value={changeType}
                    onChange={(e) => setChangeType(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="QUANTITY_CHANGE">QUANTITY_CHANGE</option>
                    <option value="MATERIAL_CHANGE">MATERIAL_CHANGE</option>
                    <option value="COST_CHANGE">COST_CHANGE</option>
                    <option value="COMPONENT_ADDITION">COMPONENT_ADDITION</option>
                    <option value="COMPONENT_REMOVAL">COMPONENT_REMOVAL</option>
                    <option value="SPECIFICATION_CHANGE">SPECIFICATION_CHANGE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700">Field / Component Identifier</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. RES-10K-0805 or quantity"
                  value={fieldName}
                  onChange={(e) => setFieldName(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700">Old Value</label>
                  <input
                    type="text"
                    placeholder="12"
                    value={oldValue}
                    onChange={(e) => setOldValue(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700">New Value</label>
                  <input
                    type="text"
                    required
                    placeholder="16"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <Button variant="outline" size="sm" type="button" onClick={() => setIsChangeModalOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit" isLoading={addChangeMutation.isPending}>
                  Save Change
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Review & Signoff Revision</h3>
              <button onClick={() => setIsReviewModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                reviewEcoMutation.mutate({
                  decision,
                  comments,
                  overrideReason: overrideReason || undefined,
                });
              }}
              className="space-y-4 mt-4"
            >
              {error && <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">{error}</div>}

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700">Review Decision</label>
                <select
                  value={decision}
                  onChange={(e: any) => setDecision(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary font-semibold"
                >
                  <option value="APPROVED">APPROVED (Promote & Release Versions)</option>
                  <option value="CHANGES_REQUESTED">CHANGES_REQUESTED (Return for Edits)</option>
                  <option value="REJECTED">REJECTED (Terminate Revision)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700">Review Comments</label>
                <textarea
                  rows={3}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Review findings, signoff notes, or required adjustments..."
                  className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {hasRole('ADMINISTRATOR') && !hasRole('APPROVER') && (
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 text-amber-700">
                    Administrator Override Justification (Mandatory)
                  </label>
                  <input
                    type="text"
                    required
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="Executive signoff for expedited production release"
                    className="mt-1 w-full px-3 py-2 text-sm bg-amber-50 border border-amber-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <Button variant="outline" size="sm" type="button" onClick={() => setIsReviewModalOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit" isLoading={reviewEcoMutation.isPending}>
                  Confirm Decision
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
