import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ECOService, ECNService } from '../../services';
import { PageHeader, EmptyState } from '../../components/ui/Cards';
import { Button } from '../../components/ui/Button';
import { StatusBadge, PriorityBadge } from '../../components/ui/Badges';
import { useAuth } from '../../context/AuthContext';
import {
  GitPullRequest,
  Plus,
  Send,
  ArrowLeft,
  X,
  FileCheck2,
  Pencil,
  Trash2,
  AlertTriangle,
  History,
  Info,
  CheckCircle2,
  Bell,
} from 'lucide-react';
import { formatDate } from '../../lib/utils';
import { ECOChange } from '../../types';

export function ECODetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission, hasRole, user } = useAuth();

  // Selected Revision for viewing/acting
  const [selectedRevNo, setSelectedRevNo] = useState<number | null>(null);

  // Generate ECN Modal State
  const [isGenerateEcnModalOpen, setIsGenerateEcnModalOpen] = useState(false);
  const [ecnEffectiveDate, setEcnEffectiveDate] = useState(() =>
    new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10)
  );
  const [ecnDepartments, setEcnDepartments] = useState<string[]>([
    'ENGINEERING',
    'QUALITY',
    'PRODUCTION',
    'PROCUREMENT',
    'INVENTORY',
    'MANAGEMENT',
  ]);
  const [ecnChangeSummary, setEcnChangeSummary] = useState('');
  const [ecnReason, setEcnReason] = useState('');

  // Add Change Modal State
  const [isChangeModalOpen, setIsChangeModalOpen] = useState(false);
  const [changeType, setChangeType] = useState('QUANTITY_CHANGE');
  const [changeTarget, setChangeTarget] = useState('COMPONENT');
  const [fieldName, setFieldName] = useState('');
  const [oldValue, setOldValue] = useState('');
  const [newValue, setNewValue] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  // Edit Change Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingChangeId, setEditingChangeId] = useState<string | null>(null);
  const [editChangeType, setEditChangeType] = useState('QUANTITY_CHANGE');
  const [editChangeTarget, setEditChangeTarget] = useState('COMPONENT');
  const [editFieldName, setEditFieldName] = useState('');
  const [editOldValue, setEditOldValue] = useState('');
  const [editNewValue, setEditNewValue] = useState('');

  // Delete Change Confirmation State
  const [deletingChangeId, setDeletingChangeId] = useState<string | null>(null);

  // Review Modal State
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED'>('APPROVED');
  const [comments, setComments] = useState('');
  const [overrideReason, setOverrideReason] = useState('');

  // Create New Revision Modal State
  const [isNewRevModalOpen, setIsNewRevModalOpen] = useState(false);
  const [newRevSummary, setNewRevSummary] = useState('');

  const { data: eco, isLoading } = useQuery({
    queryKey: ['eco', id],
    queryFn: () => ECOService.getECO(id!),
    enabled: !!id,
  });

  // Sync selected revision to active_revision_no on initial load
  useEffect(() => {
    if (eco && selectedRevNo === null) {
      setSelectedRevNo(eco.active_revision_no);
    }
  }, [eco, selectedRevNo]);

  // Mutations
  const addChangeMutation = useMutation({
    mutationFn: (payload: any) => ECOService.addChange(id!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eco', id] });
      setIsChangeModalOpen(false);
      setFieldName('');
      setOldValue('');
      setNewValue('');
      setModalError(null);
    },
    onError: (err: any) => {
      setModalError(err.response?.data?.error?.message || 'Failed to record revision change item');
    },
  });

  const updateChangeMutation = useMutation({
    mutationFn: (payload: { changeId: string; data: any }) =>
      ECOService.updateChange(id!, payload.changeId, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eco', id] });
      setIsEditModalOpen(false);
      setEditingChangeId(null);
      setModalError(null);
    },
    onError: (err: any) => {
      setModalError(err.response?.data?.error?.message || 'Failed to update change item');
    },
  });

  const removeChangeMutation = useMutation({
    mutationFn: (changeId: string) => ECOService.removeChange(id!, changeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eco', id] });
      setDeletingChangeId(null);
    },
    onError: (err: any) => {
      alert(err.response?.data?.error?.message || 'Failed to delete change item');
      setDeletingChangeId(null);
    },
  });

  const createRevisionMutation = useMutation({
    mutationFn: (payload: { changeSummary?: string }) => ECOService.createRevision(id!, payload),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['eco', id] });
      setIsNewRevModalOpen(false);
      setNewRevSummary('');
      setModalError(null);
      if (data?.revision?.revision_number) {
        setSelectedRevNo(data.revision.revision_number);
      }
    },
    onError: (err: any) => {
      setModalError(err.response?.data?.error?.message || 'Failed to initialize new revision');
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
      setModalError(null);
    },
    onError: (err: any) => {
      setModalError(err.response?.data?.error?.message || 'Review signoff failed');
    },
  });

  const generateEcnMutation = useMutation({
    mutationFn: (payload: any) => ECNService.generateECN(id!, payload),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['eco', id] });
      setIsGenerateEcnModalOpen(false);
      navigate(`/ecns/${data.id}`);
    },
    onError: (err: any) => {
      setModalError(err.response?.data?.error?.message || 'Failed to generate change notice');
    },
  });

  if (isLoading) {
    return <div className="p-8 text-center text-sm text-slate-500">Loading ECO workspace...</div>;
  }

  if (!eco) {
    return <div className="p-8 text-center text-sm text-slate-500">Engineering change order not found.</div>;
  }

  // Active revision logic
  const activeRevNo = eco.active_revision_no;
  const currentViewRevNo = selectedRevNo ?? activeRevNo;

  const revisions = (eco.eco_revisions || []).slice().sort((a, b) => b.revision_number - a.revision_number);
  const selectedRev = revisions.find((r) => r.revision_number === currentViewRevNo) || revisions[0];

  const isActiveRevision = currentViewRevNo === activeRevNo;
  const isDraft = isActiveRevision && (selectedRev?.status === 'DRAFT' || eco.status === 'DRAFT');
  const isReviewable =
    isActiveRevision &&
    (selectedRev?.status === 'SUBMITTED' || selectedRev?.status === 'UNDER_REVIEW' || eco.status === 'SUBMITTED' || eco.status === 'UNDER_REVIEW');
  const isChangesRequested =
    isActiveRevision && (selectedRev?.status === 'CHANGES_REQUESTED' || eco.status === 'CHANGES_REQUESTED');

  const canReview = hasPermission('eco:approve') || hasRole('APPROVER') || hasRole('ADMINISTRATOR');
  const isAuthorOrLead =
    eco.created_by === user?.id || hasRole('ADMINISTRATOR') || hasRole('LEAD_ENGINEER') || hasPermission('eco:edit');

  const displayedChanges: ECOChange[] = selectedRev?.changes || (isActiveRevision ? eco.eco_changes || [] : []);

  const openEditModal = (ch: ECOChange) => {
    setEditingChangeId(ch.id);
    setEditChangeType(ch.change_type);
    setEditChangeTarget(ch.change_target);
    setEditFieldName(ch.field_name);
    setEditOldValue(ch.old_value || '');
    setEditNewValue(ch.new_value || '');
    setModalError(null);
    setIsEditModalOpen(true);
  };

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
        <StatusBadge status={selectedRev ? selectedRev.status : eco.status} />

        {isDraft && (
          <>
            <Button variant="outline" size="sm" onClick={() => setIsChangeModalOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              <span>Add Change Item</span>
            </Button>
            <Button
              size="sm"
              onClick={() => submitEcoMutation.mutate()}
              isLoading={submitEcoMutation.isPending}
              disabled={displayedChanges.length === 0}
            >
              <Send className="w-4 h-4 mr-1.5" />
              <span>Submit for Review</span>
            </Button>
          </>
        )}

        {isChangesRequested && isAuthorOrLead && (
          <Button size="sm" onClick={() => setIsNewRevModalOpen(true)} className="bg-amber-600 hover:bg-amber-700">
            <Plus className="w-4 h-4 mr-1.5" />
            <span>Create Revision {activeRevNo + 1}</span>
          </Button>
        )}

        {isReviewable && canReview && (
          <Button size="sm" onClick={() => setIsReviewModalOpen(true)}>
            <FileCheck2 className="w-4 h-4 mr-1.5" />
            <span>Signoff / Review</span>
          </Button>
        )}

        {eco.status === 'APPROVED' && (
          eco.ecn ? (
            <Link to={`/ecns/${eco.ecn.id}`}>
              <Button size="sm" variant="outline" className="border-teal-300 text-teal-700 hover:bg-teal-50">
                <Bell className="w-4 h-4 mr-1.5" />
                <span>View Notice ({eco.ecn.ecn_number})</span>
              </Button>
            </Link>
          ) : (
            (isAuthorOrLead || canReview || hasPermission('ecn:generate')) && (
              <Button
                size="sm"
                onClick={() => {
                  setEcnChangeSummary(eco.description || eco.title);
                  setIsGenerateEcnModalOpen(true);
                }}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                <Bell className="w-4 h-4 mr-1.5" />
                <span>Generate Notice (ECN)</span>
              </Button>
            )
          )
        )}
      </PageHeader>

      {/* Released ECO / ECN Notice Banner */}
      {eco.status === 'APPROVED' && (
        <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl text-teal-900 flex items-start justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold">
                {eco.ecn ? `Engineering Change Notice Active: ${eco.ecn.ecn_number}` : 'Engineering Change Order Released'}
              </h4>
              <p className="text-xs text-teal-700">
                {eco.ecn
                  ? `Notice ${eco.ecn.ecn_number} is in status ${eco.ecn.status}. Stakeholder departments are coordinating acknowledgement and material disposition.`
                  : 'This change order has completed formal approval and released product & BOM revisions. Generate an Engineering Change Notice (ECN) to coordinate departmental distribution and material disposition instructions.'}
              </p>
            </div>
          </div>
          {eco.ecn ? (
            <Link to={`/ecns/${eco.ecn.id}`}>
              <Button size="sm" className="bg-teal-700 hover:bg-teal-800 text-white shrink-0">
                <Bell className="w-4 h-4 mr-1.5" />
                <span>Open ECN</span>
              </Button>
            </Link>
          ) : (
            (isAuthorOrLead || canReview || hasPermission('ecn:generate')) && (
              <Button
                size="sm"
                onClick={() => {
                  setEcnChangeSummary(eco.description || eco.title);
                  setIsGenerateEcnModalOpen(true);
                }}
                className="bg-teal-600 hover:bg-teal-700 text-white shrink-0"
              >
                <Bell className="w-4 h-4 mr-1.5" />
                <span>Generate ECN</span>
              </Button>
            )
          )}
        </div>
      )}

      {/* Reviewer Feedback Banner when CHANGES_REQUESTED */}
      {selectedRev?.approval?.decision === 'CHANGES_REQUESTED' && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-start justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold">Reviewer Feedback — Changes Requested</h4>
              {selectedRev.approval.comments ? (
                <p className="text-xs italic text-amber-800">"{selectedRev.approval.comments}"</p>
              ) : (
                <p className="text-xs text-amber-700">No additional comment recorded by the reviewer.</p>
              )}
              <div className="text-[11px] text-amber-700">
                Reviewed by{' '}
                <span className="font-semibold">
                  {selectedRev.approval.approver
                    ? `${selectedRev.approval.approver.first_name} ${selectedRev.approval.approver.last_name}`
                    : 'Design Authority'}
                </span>{' '}
                on {formatDate(selectedRev.approval.created_at)}.
              </div>
            </div>
          </div>
          {isActiveRevision && isAuthorOrLead && (
            <Button
              size="sm"
              onClick={() => setIsNewRevModalOpen(true)}
              className="bg-amber-600 hover:bg-amber-700 shrink-0 text-white"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              <span>Create Revision {activeRevNo + 1}</span>
            </Button>
          )}
        </div>
      )}

      {/* Historical Revision Notice */}
      {!isActiveRevision && (
        <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-700 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            <span>
              Viewing <strong>Historical Revision {currentViewRevNo}</strong> (Read-Only). The active revision is{' '}
              <strong>Revision {activeRevNo}</strong>.
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="text-xs py-1 h-7"
            onClick={() => setSelectedRevNo(activeRevNo)}
          >
            Switch to Active Revision ({activeRevNo})
          </Button>
        </div>
      )}

      {/* Metadata KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Target Product</span>
          <span className="text-sm font-bold text-slate-900 font-mono mt-1 block">
            {eco.product?.part_number || 'N/A'} (v{eco.product?.current_version})
          </span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Selected Revision</span>
            {isActiveRevision && (
              <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                Active
              </span>
            )}
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-sm font-bold text-slate-900">Revision {currentViewRevNo}</span>
            {revisions.length > 1 && (
              <select
                value={currentViewRevNo}
                onChange={(e) => setSelectedRevNo(Number(e.target.value))}
                className="text-xs border border-slate-200 rounded px-2 py-1 bg-slate-50 font-semibold focus:outline-none"
              >
                {revisions.map((rev) => (
                  <option key={rev.revision_number} value={rev.revision_number}>
                    Rev {rev.revision_number} ({rev.status}) {rev.revision_number === activeRevNo ? '• Active' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Change Items</span>
          <span className="text-sm font-bold text-slate-900 mt-1 block">
            {displayedChanges.length} Modification{displayedChanges.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Revision Summary</span>
          <span className="text-xs text-slate-700 mt-1 block truncate" title={selectedRev?.change_summary}>
            {selectedRev?.change_summary || 'Initial revision'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Change Items Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Revision {currentViewRevNo} Change Items
                </h3>
                <p className="text-xs text-slate-400">
                  {isDraft ? 'Modifications in draft revision can be edited or removed' : 'Historical records locked on submission'}
                </p>
              </div>
              {isDraft && (
                <Button size="sm" onClick={() => setIsChangeModalOpen(true)}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  <span>Add Change</span>
                </Button>
              )}
            </div>

            {displayedChanges.length === 0 ? (
              <EmptyState
                icon={GitPullRequest}
                title="No change items recorded"
                description={
                  isDraft
                    ? 'Record parameter diffs, quantity changes, or BOM component adjustments.'
                    : 'No changes were logged for this revision.'
                }
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
                      {isDraft && <th className="py-3 px-4 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedChanges.map((ch) => (
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
                        {isDraft && (
                          <td className="py-3 px-4 text-right space-x-1">
                            <button
                              onClick={() => openEditModal(ch)}
                              className="p-1 text-slate-400 hover:text-slate-800 rounded hover:bg-slate-100 transition-colors"
                              title="Edit Change Item"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeletingChangeId(ch.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                              title="Delete Change Item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
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
            <h3 className="text-sm font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100 flex items-center justify-between">
              <span>Revision {currentViewRevNo} Signoff</span>
              <StatusBadge status={selectedRev?.status || 'DRAFT'} />
            </h3>

            {!selectedRev?.approval ? (
              <div className="text-xs text-slate-400 text-center py-6">
                No formal review decision logged for Revision {currentViewRevNo}.
              </div>
            ) : (
              <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">
                    {selectedRev.approval.approver
                      ? `${selectedRev.approval.approver.first_name} ${selectedRev.approval.approver.last_name}`
                      : 'Reviewer'}
                  </span>
                  <StatusBadge status={selectedRev.approval.decision} />
                </div>
                {selectedRev.approval.comments && (
                  <p className="text-slate-600 italic">"{selectedRev.approval.comments}"</p>
                )}
                <span className="text-[10px] text-slate-400 block">{formatDate(selectedRev.approval.created_at)}</span>
              </div>
            )}
          </div>

          {/* Revisions History List */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
              <History className="w-4 h-4 text-slate-400" />
              <span>All Revisions ({revisions.length})</span>
            </h3>

            <div className="space-y-2">
              {revisions.map((rev) => {
                const isSelected = rev.revision_number === currentViewRevNo;
                return (
                  <button
                    key={rev.revision_number}
                    onClick={() => setSelectedRevNo(rev.revision_number)}
                    className={`w-full text-left p-3 rounded-lg border transition-all text-xs flex items-center justify-between ${
                      isSelected
                        ? 'border-primary bg-primary/5 text-slate-900 font-semibold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span>Revision {rev.revision_number}</span>
                        {rev.revision_number === activeRevNo && (
                          <span className="text-[9px] uppercase px-1 py-0.2 bg-emerald-100 text-emerald-800 rounded font-bold">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 font-normal mt-0.5 line-clamp-1">
                        {rev.change_summary || 'Initial revision'}
                      </p>
                    </div>
                    <StatusBadge status={rev.status} />
                  </button>
                );
              })}
            </div>
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
                setModalError(null);
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
              {modalError && (
                <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                  {modalError}
                </div>
              )}

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

      {/* Edit Change Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Edit Change Item</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setModalError(null);
                if (!editingChangeId) return;
                updateChangeMutation.mutate({
                  changeId: editingChangeId,
                  data: {
                    changeType: editChangeType,
                    changeTarget: editChangeTarget,
                    fieldName: editFieldName,
                    oldValue: editOldValue,
                    newValue: editNewValue,
                  },
                });
              }}
              className="space-y-4 mt-4"
            >
              {modalError && (
                <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                  {modalError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700">Target Entity</label>
                  <select
                    value={editChangeTarget}
                    onChange={(e) => setEditChangeTarget(e.target.value)}
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
                    value={editChangeType}
                    onChange={(e) => setEditChangeType(e.target.value)}
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
                  value={editFieldName}
                  onChange={(e) => setEditFieldName(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700">Old Value</label>
                  <input
                    type="text"
                    value={editOldValue}
                    onChange={(e) => setEditOldValue(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700">New Value</label>
                  <input
                    type="text"
                    required
                    value={editNewValue}
                    onChange={(e) => setEditNewValue(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <Button variant="outline" size="sm" type="button" onClick={() => setIsEditModalOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit" isLoading={updateChangeMutation.isPending}>
                  Update Change
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingChangeId && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-bold text-slate-900">Delete Change Item?</h3>
            </div>
            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              Are you sure you want to remove this modification from Revision {currentViewRevNo}? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" size="sm" onClick={() => setDeletingChangeId(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-rose-600 hover:bg-rose-700 text-white"
                onClick={() => removeChangeMutation.mutate(deletingChangeId)}
                isLoading={removeChangeMutation.isPending}
              >
                Confirm Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create New Revision Modal */}
      {isNewRevModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-sm">
                  v{activeRevNo + 1}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Create Revision {activeRevNo + 1}</h3>
                  <p className="text-xs text-slate-400">Initialize iterative change draft</p>
                </div>
              </div>
              <button onClick={() => setIsNewRevModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setModalError(null);
                createRevisionMutation.mutate({
                  changeSummary: newRevSummary || undefined,
                });
              }}
              className="space-y-4 mt-4"
            >
              {modalError && (
                <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                  {modalError}
                </div>
              )}

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 leading-relaxed">
                All change items from <strong>Revision {activeRevNo}</strong> will be cloned into the new draft revision. Revision {activeRevNo} and its historical snapshots will remain preserved and immutable.
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700">
                  Revision Summary / Feedback Response
                </label>
                <textarea
                  rows={3}
                  required
                  value={newRevSummary}
                  onChange={(e) => setNewRevSummary(e.target.value)}
                  placeholder={`e.g. Revision ${activeRevNo + 1} - Addressed reviewer feedback regarding fastener torque`}
                  className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <Button variant="outline" size="sm" type="button" onClick={() => setIsNewRevModalOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit" isLoading={createRevisionMutation.isPending} className="bg-amber-600 hover:bg-amber-700 text-white">
                  Create Revision {activeRevNo + 1}
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
              <h3 className="text-base font-bold text-slate-900">Review & Signoff Revision {currentViewRevNo}</h3>
              <button onClick={() => setIsReviewModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setModalError(null);
                reviewEcoMutation.mutate({
                  decision,
                  comments,
                  overrideReason: overrideReason || undefined,
                });
              }}
              className="space-y-4 mt-4"
            >
              {modalError && (
                <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                  {modalError}
                </div>
              )}

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

      {/* Generate ECN Modal */}
      {isGenerateEcnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-teal-600" />
                <h3 className="font-bold text-slate-900 text-base">Generate Engineering Change Notice</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsGenerateEcnModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Formally notify production, quality, procurement, and inventory of the released changes under{' '}
              <span className="font-semibold text-slate-700">{eco.eco_number}</span>.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setModalError(null);
                if (ecnDepartments.length === 0) {
                  setModalError('Please select at least one target department');
                  return;
                }
                generateEcnMutation.mutate({
                  effectiveDate: new Date(ecnEffectiveDate).toISOString(),
                  targetDepartments: ecnDepartments,
                  changeSummary: ecnChangeSummary || eco.title,
                  reasonForChange: ecnReason || undefined,
                });
              }}
              className="space-y-4"
            >
              {modalError && (
                <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                  {modalError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700">Effective Date *</label>
                <input
                  type="date"
                  required
                  value={ecnEffectiveDate}
                  onChange={(e) => setEcnEffectiveDate(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1.5">
                  Target Departments for Distribution *
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {['ENGINEERING', 'QUALITY', 'PRODUCTION', 'PROCUREMENT', 'INVENTORY', 'MANAGEMENT'].map((dept) => {
                    const checked = ecnDepartments.includes(dept);
                    return (
                      <label
                        key={dept}
                        className={`flex items-center gap-2 p-2 border rounded-lg cursor-pointer transition-colors ${
                          checked ? 'bg-teal-50 border-teal-300 text-teal-900 font-medium' : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEcnDepartments([...ecnDepartments, dept]);
                            } else {
                              setEcnDepartments(ecnDepartments.filter((d) => d !== dept));
                            }
                          }}
                          className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4"
                        />
                        <span>{dept}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700">Change Summary</label>
                <textarea
                  rows={2}
                  value={ecnChangeSummary}
                  onChange={(e) => setEcnChangeSummary(e.target.value)}
                  placeholder="Summary of changes taking effect in manufacturing..."
                  className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700">Reason / Notes for Manufacturing</label>
                <textarea
                  rows={2}
                  value={ecnReason}
                  onChange={(e) => setEcnReason(e.target.value)}
                  placeholder="Operational context, justification, or line cutover details..."
                  className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <Button variant="outline" size="sm" type="button" onClick={() => setIsGenerateEcnModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  type="submit"
                  isLoading={generateEcnMutation.isPending}
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                >
                  Generate ECN
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default ECODetail;
