import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ECRService, ProductService, BOMService, UserService } from '../../services';
import { Button } from '../../components/ui/Button';
import { StatusBadge, PriorityBadge, RequestTypeBadge } from '../../components/ui/Badges';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../lib/utils';
import {
  ArrowLeft,
  ClipboardList,
  GitPullRequest,
  CheckCircle,
  XCircle,
  HelpCircle,
  Play,
  UserCheck,
  AlertTriangle,
  Layers,
  Box,
  Clock,
  User,
  Paperclip,
  Check,
  Send,
  ExternalLink,
} from 'lucide-react';

export function ECRDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, hasRole, hasPermission } = useAuth();

  // Dialog / Modal States
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isStartReviewOpen, setIsStartReviewOpen] = useState(false);
  const [isRequestInfoOpen, setIsRequestInfoOpen] = useState(false);
  const [isResubmitOpen, setIsResubmitOpen] = useState(false);
  const [isAcceptOpen, setIsAcceptOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isPromoteOpen, setIsPromoteOpen] = useState(false);

  // Form Field States
  const [assignedTo, setAssignedTo] = useState('');
  const [reviewComments, setReviewComments] = useState('');
  const [infoRequestComments, setInfoRequestComments] = useState('');
  const [resubmitComments, setResubmitComments] = useState('');
  const [resubmitDescription, setResubmitDescription] = useState('');
  const [resubmitSolution, setResubmitSolution] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [ecoNumber, setEcoNumber] = useState('');
  const [promoteProductId, setPromoteProductId] = useState('');
  const [promoteBomId, setPromoteBomId] = useState('');
  const [promoteChangeSummary, setPromoteChangeSummary] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  // Load ECR
  const {
    data: ecr,
    isLoading,
    error: loadError,
  } = useQuery({
    queryKey: ['ecr', id],
    queryFn: () => ECRService.getECR(id!),
    enabled: !!id,
  });

  // Supporting queries for assignment and promotion
  const { data: usersData } = useQuery({
    queryKey: ['users-assign-list'],
    queryFn: () => UserService.listUsers(1, 100),
    enabled: isAssignOpen,
  });

  const { data: productsData } = useQuery({
    queryKey: ['products-promote-list'],
    queryFn: () => ProductService.listProducts(1, 100),
    enabled: isPromoteOpen,
  });

  const { data: bomsData } = useQuery({
    queryKey: ['boms-promote-list'],
    queryFn: () => BOMService.listBOMs(1, 100),
    enabled: isPromoteOpen,
  });

  const usersList = usersData?.data || [];
  const products = productsData?.data || [];
  const allBoms = bomsData?.data || [];
  const activeProductId = promoteProductId || ecr?.product_id;
  const availableBoms = activeProductId ? allBoms.filter((b: any) => b.product_id === activeProductId) : allBoms;

  // Authorization checks
  const isReviewer =
    hasRole('ADMINISTRATOR') ||
    hasRole('LEAD_ENGINEER') ||
    hasRole('APPROVER') ||
    hasPermission('ecr:review') ||
    hasPermission('admin:all');

  const canPromote =
    hasRole('ADMINISTRATOR') ||
    hasRole('LEAD_ENGINEER') ||
    hasPermission('ecr:promote') ||
    hasPermission('admin:all');

  const isSubmitter = user?.id === ecr?.submitted_by;

  // Generic mutation invalidation helper
  const handleMutationSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['ecr', id] });
    queryClient.invalidateQueries({ queryKey: ['ecrs'] });
    setActionError(null);
  };

  // Action Mutations
  const assignMutation = useMutation({
    mutationFn: (assigneeId: string) => ECRService.assignECR(id!, assigneeId),
    onSuccess: () => {
      handleMutationSuccess();
      setIsAssignOpen(false);
    },
    onError: (err: any) => setActionError(err.response?.data?.error?.message || 'Failed to assign reviewer'),
  });

  const startReviewMutation = useMutation({
    mutationFn: (comments?: string) => ECRService.startReview(id!, comments),
    onSuccess: () => {
      handleMutationSuccess();
      setIsStartReviewOpen(false);
    },
    onError: (err: any) => setActionError(err.response?.data?.error?.message || 'Failed to start review'),
  });

  const requestInfoMutation = useMutation({
    mutationFn: (comments: string) => ECRService.requestInformation(id!, comments),
    onSuccess: () => {
      handleMutationSuccess();
      setIsRequestInfoOpen(false);
      setInfoRequestComments('');
    },
    onError: (err: any) => setActionError(err.response?.data?.error?.message || 'Failed to request information'),
  });

  const resubmitMutation = useMutation({
    mutationFn: (payload: any) => ECRService.resubmitECR(id!, payload),
    onSuccess: () => {
      handleMutationSuccess();
      setIsResubmitOpen(false);
    },
    onError: (err: any) => setActionError(err.response?.data?.error?.message || 'Failed to resubmit information'),
  });

  const acceptMutation = useMutation({
    mutationFn: (comments?: string) => ECRService.acceptECR(id!, comments),
    onSuccess: () => {
      handleMutationSuccess();
      setIsAcceptOpen(false);
    },
    onError: (err: any) => setActionError(err.response?.data?.error?.message || 'Failed to accept change request'),
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => ECRService.rejectECR(id!, reason),
    onSuccess: () => {
      handleMutationSuccess();
      setIsRejectOpen(false);
    },
    onError: (err: any) => setActionError(err.response?.data?.error?.message || 'Failed to reject change request'),
  });

  const promoteMutation = useMutation({
    mutationFn: (payload: any) => ECRService.promoteToECO(id!, payload),
    onSuccess: (data: any) => {
      handleMutationSuccess();
      setIsPromoteOpen(false);
      if (data?.eco?.id) {
        navigate(`/ecos/${data.eco.id}`);
      }
    },
    onError: (err: any) => setActionError(err.response?.data?.error?.message || 'Failed to promote ECR to ECO'),
  });

  if (isLoading) {
    return (
      <div className="p-12 text-center text-sm text-slate-500">
        <ClipboardList className="w-8 h-8 animate-pulse text-primary mx-auto mb-3" />
        Loading change request details...
      </div>
    );
  }

  if (loadError || !ecr) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-base font-bold text-slate-800">Change Request Not Found</h2>
        <p className="text-xs text-slate-500">
          The requested change order does not exist or you do not have permission to view it.
        </p>
        <Link to="/ecrs">
          <Button variant="outline" size="sm">
            Back to Change Requests
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Navigation & Status Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/ecrs" className="text-slate-400 hover:text-slate-700 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-slate-500">{ecr.ecr_number}</span>
              <StatusBadge status={ecr.status} />
              <PriorityBadge priority={ecr.priority} />
              <RequestTypeBadge type={ecr.request_type} />
            </div>
            <h1 className="text-xl font-bold text-slate-900 mt-1">{ecr.title}</h1>
          </div>
        </div>

        {/* Header Action Shortcuts */}
        <div className="flex items-center gap-2">
          {isReviewer && ecr.status !== 'REJECTED' && ecr.status !== 'PROMOTED' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAssignedTo(ecr.assigned_to || '');
                setIsAssignOpen(true);
              }}
            >
              <UserCheck className="w-4 h-4 mr-1.5" />
              <span>{ecr.assignee ? 'Reassign Reviewer' : 'Assign Reviewer'}</span>
            </Button>
          )}

          {ecr.status === 'ACCEPTED' && canPromote && (
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={() => {
                const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                setEcoNumber(`ECO-${today}-${ecr.ecr_number.slice(-4)}`);
                setPromoteProductId(ecr.product_id || '');
                setPromoteBomId(ecr.bom_id || '');
                setPromoteChangeSummary(`Formal engineering implementation derived from ${ecr.ecr_number}`);
                setIsPromoteOpen(true);
              }}
            >
              <GitPullRequest className="w-4 h-4 mr-1.5" />
              <span>Promote to ECO</span>
            </Button>
          )}
        </div>
      </div>

      {/* Promoted ECO Linked Alert */}
      {ecr.promoted_eco && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0">
              <GitPullRequest className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
                Promoted to Engineering Change Order
              </div>
              <div className="text-sm font-bold text-indigo-950 flex items-center gap-2 mt-0.5">
                <span>{ecr.promoted_eco.eco_number}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-indigo-200/70 font-semibold text-indigo-800">
                  {ecr.promoted_eco.status}
                </span>
              </div>
            </div>
          </div>
          <Link to={`/ecos/${ecr.promoted_eco.id}`}>
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
              <span>Open ECO Workspace</span>
              <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </Link>
        </div>
      )}

      {/* Action Error Banner */}
      {actionError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-500 hover:text-rose-800 text-xs font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* Rejection Alert Banner (if rejected) */}
      {ecr.status === 'REJECTED' && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-900">
          <div className="flex items-center gap-2 font-bold text-sm text-rose-800 mb-1">
            <XCircle className="w-4 h-4 text-rose-600" />
            <span>Change Request Rejected</span>
          </div>
          <p className="text-xs text-rose-700 leading-relaxed">
            <strong>Reason:</strong> {ecr.rejection_reason || 'No specific rationale provided.'}
          </p>
        </div>
      )}

      {/* Needs Information Alert Banner */}
      {ecr.status === 'NEEDS_INFORMATION' && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-bold text-sm text-amber-800">
              <HelpCircle className="w-4 h-4 text-amber-600" />
              <span>Reviewer Requested Additional Information</span>
            </div>
            <p className="text-xs text-amber-700 leading-relaxed">
              {ecr.review_comments || 'Please clarify problem symptoms or defect specifics.'}
            </p>
          </div>
          {(isSubmitter || isReviewer) && (
            <Button
              size="sm"
              onClick={() => {
                setResubmitDescription(ecr.description);
                setResubmitSolution(ecr.suggested_solution || '');
                setResubmitComments('');
                setIsResubmitOpen(true);
              }}
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              <span>Provide Info & Resubmit</span>
            </Button>
          )}
        </div>
      )}

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Details & Problem Description (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Problem Statement Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">Problem Description</h3>
            <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">{ecr.description}</p>

            {ecr.suggested_solution && (
              <div className="pt-4 border-t border-slate-100">
                <h4 className="text-xs font-semibold uppercase text-slate-600 mb-1">Suggested Solution / Remedy</h4>
                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{ecr.suggested_solution}</p>
              </div>
            )}
          </div>

          {/* Product & Component Context Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-4">Hardware Context</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center gap-2 text-slate-500 font-semibold mb-1">
                  <Box className="w-3.5 h-3.5 text-primary" />
                  <span>Related Product</span>
                </div>
                {ecr.product ? (
                  <Link
                    to={`/products/${ecr.product.id}`}
                    className="font-semibold text-slate-900 hover:text-primary transition-colors"
                  >
                    {ecr.product.part_number} — {ecr.product.name}
                  </Link>
                ) : (
                  <span className="text-slate-400 italic">Not product specific</span>
                )}
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center gap-2 text-slate-500 font-semibold mb-1">
                  <Layers className="w-3.5 h-3.5 text-teal-600" />
                  <span>Associated BOM</span>
                </div>
                {ecr.bom ? (
                  <Link
                    to={`/boms/${ecr.bom.id}`}
                    className="font-semibold text-slate-900 hover:text-primary transition-colors font-mono"
                  >
                    {ecr.bom.bom_number}
                  </Link>
                ) : (
                  <span className="text-slate-400 italic">None referenced</span>
                )}
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 sm:col-span-2">
                <div className="text-slate-500 font-semibold mb-1">Affected Component / Part Number</div>
                <div className="font-mono text-slate-900 font-bold">
                  {ecr.affected_part_number || <span className="text-slate-400 font-normal italic">None specified</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Review Notes / Audit Log Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">Engineering Review History</h3>
            {ecr.review_comments ? (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                {ecr.review_comments}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No reviewer comments logged yet.</p>
            )}
          </div>
        </div>

        {/* Right Column: Review Workspace & Metadata Panel (1 col) */}
        <div className="space-y-6">
          {/* Metadata Sidebar Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4 text-xs">
            <h3 className="font-bold uppercase tracking-wider text-slate-700">Request Metadata</h3>

            <div className="space-y-3 divide-y divide-slate-100">
              <div className="flex items-center justify-between pt-2">
                <span className="text-slate-500">Status</span>
                <StatusBadge status={ecr.status} />
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-slate-500">Priority</span>
                <PriorityBadge priority={ecr.priority} />
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-slate-500">Request Type</span>
                <RequestTypeBadge type={ecr.request_type} />
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-slate-500">Submitted By</span>
                <span className="font-medium text-slate-800">
                  {ecr.submitter ? `${ecr.submitter.first_name} ${ecr.submitter.last_name}` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-slate-500">Assigned Reviewer</span>
                <span className="font-medium text-slate-800">
                  {ecr.assignee ? `${ecr.assignee.first_name} ${ecr.assignee.last_name}` : 'Unassigned'}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-slate-500">Submitted At</span>
                <span className="text-slate-700">{formatDate(ecr.submitted_at)}</span>
              </div>
              {ecr.reviewed_at && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-slate-500">Last Reviewed</span>
                  <span className="text-slate-700">{formatDate(ecr.reviewed_at)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Reviewer Action Workspace Panel */}
          {isReviewer && ecr.status !== 'REJECTED' && ecr.status !== 'PROMOTED' && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Review Actions</h3>
                <span className="text-[10px] text-slate-400 font-semibold uppercase">{ecr.status}</span>
              </div>

              <div className="space-y-2">
                {/* SUBMITTED actions */}
                {ecr.status === 'SUBMITTED' && (
                  <>
                    <Button
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => setIsStartReviewOpen(true)}
                    >
                      <Play className="w-4 h-4 mr-2 text-emerald-400" />
                      <span>Start Formal Review</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                      onClick={() => {
                        setRejectionReason('');
                        setIsRejectOpen(true);
                      }}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      <span>Reject Request</span>
                    </Button>
                  </>
                )}

                {/* UNDER_REVIEW actions */}
                {ecr.status === 'UNDER_REVIEW' && (
                  <>
                    <Button
                      size="sm"
                      className="w-full justify-start bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => {
                        setReviewComments('');
                        setIsAcceptOpen(true);
                      }}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      <span>Accept Change Request</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-amber-700 hover:bg-amber-50"
                      onClick={() => {
                        setInfoRequestComments('');
                        setIsRequestInfoOpen(true);
                      }}
                    >
                      <HelpCircle className="w-4 h-4 mr-2 text-amber-500" />
                      <span>Request More Information</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                      onClick={() => {
                        setRejectionReason('');
                        setIsRejectOpen(true);
                      }}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      <span>Reject Request</span>
                    </Button>
                  </>
                )}

                {/* ACCEPTED actions */}
                {ecr.status === 'ACCEPTED' && canPromote && (
                  <Button
                    size="sm"
                    className="w-full justify-start bg-indigo-600 hover:bg-indigo-700 text-white"
                    onClick={() => {
                      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                      setEcoNumber(`ECO-${today}-${ecr.ecr_number.slice(-4)}`);
                      setPromoteProductId(ecr.product_id || '');
                      setPromoteBomId(ecr.bom_id || '');
                      setPromoteChangeSummary(`Formal engineering implementation derived from ${ecr.ecr_number}`);
                      setIsPromoteOpen(true);
                    }}
                  >
                    <GitPullRequest className="w-4 h-4 mr-2" />
                    <span>Promote to ECO</span>
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Attachments Notice Card */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
            <div className="flex items-center gap-2 font-semibold text-slate-700">
              <Paperclip className="w-3.5 h-3.5 text-slate-500" />
              <span>Attachments (Global Restriction)</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              File and media uploads are restricted in this version. All relevant part numbers and defect details must
              be documented in the request text.
            </p>
          </div>
        </div>
      </div>

      {/* Start Review Modal */}
      {isStartReviewOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-900 mb-2">Start Formal Review</h3>
            <p className="text-xs text-slate-600 mb-4">
              Transition this ECR from <strong>SUBMITTED</strong> to <strong>UNDER_REVIEW</strong> and assign it to you.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                  Optional Review Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Taking ownership for line validation review..."
                  value={reviewComments}
                  onChange={(e) => setReviewComments(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setIsStartReviewOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={startReviewMutation.isPending}
                  onClick={() => startReviewMutation.mutate(reviewComments || undefined)}
                >
                  {startReviewMutation.isPending ? 'Starting...' : 'Confirm Start Review'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Request Information Modal */}
      {isRequestInfoOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-900 mb-2">Request Additional Information</h3>
            <p className="text-xs text-slate-600 mb-4">
              State clearly what clarifications, defect photos, or measurements are required from the submitter.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                  Reviewer Inquiry <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Specify the missing details or measurements required..."
                  value={infoRequestComments}
                  onChange={(e) => setInfoRequestComments(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setIsRequestInfoOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={!infoRequestComments.trim() || requestInfoMutation.isPending}
                  onClick={() => requestInfoMutation.mutate(infoRequestComments.trim())}
                >
                  {requestInfoMutation.isPending ? 'Sending...' : 'Send Request to Submitter'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Submitter Resubmit / Provide Info Modal */}
      {isResubmitOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-900 mb-2">Respond to Information Request</h3>
            <p className="text-xs text-slate-600 mb-4">
              Provide clarification and update problem description or solution as needed.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                  Response Comments
                </label>
                <textarea
                  rows={2}
                  placeholder="Add your comments addressing the reviewer's inquiry..."
                  value={resubmitComments}
                  onChange={(e) => setResubmitComments(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                  Updated Description
                </label>
                <textarea
                  rows={3}
                  value={resubmitDescription}
                  onChange={(e) => setResubmitDescription(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                  Updated Suggested Solution (Optional)
                </label>
                <textarea
                  rows={2}
                  value={resubmitSolution}
                  onChange={(e) => setResubmitSolution(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setIsResubmitOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={resubmitMutation.isPending}
                  onClick={() =>
                    resubmitMutation.mutate({
                      comments: resubmitComments.trim() || undefined,
                      description: resubmitDescription.trim() || undefined,
                      suggestedSolution: resubmitSolution.trim() || undefined,
                    })
                  }
                >
                  {resubmitMutation.isPending ? 'Submitting...' : 'Resubmit for Review'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Accept ECR Modal */}
      {isAcceptOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-900 mb-2">Accept Change Request</h3>
            <p className="text-xs text-slate-600 mb-4">
              Accepting confirms that this change request has engineering merit and can proceed to formal ECO promotion.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                  Optional Acceptance Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Verified interference on Station 4 fixture. Ready for ECO drafting."
                  value={reviewComments}
                  onChange={(e) => setReviewComments(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setIsAcceptOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={acceptMutation.isPending}
                  onClick={() => acceptMutation.mutate(reviewComments || undefined)}
                >
                  {acceptMutation.isPending ? 'Accepting...' : 'Confirm Acceptance'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject ECR Modal */}
      {isRejectOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-900 mb-2">Reject Change Request</h3>
            <p className="text-xs text-slate-600 mb-4">
              Rejection is a terminal state. A non-empty reason is mandatory to explain why the request was declined.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                  Mandatory Rejection Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Explain why this change request is out of scope, not reproducible, or declined..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setIsRejectOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                  disabled={!rejectionReason.trim() || rejectMutation.isPending}
                  onClick={() => rejectMutation.mutate(rejectionReason.trim())}
                >
                  {rejectMutation.isPending ? 'Rejecting...' : 'Confirm Rejection'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Promote to ECO Modal */}
      {isPromoteOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <GitPullRequest className="w-5 h-5 text-indigo-600" />
              <h3 className="text-base font-bold text-slate-900">Promote ECR to Change Order (ECO)</h3>
            </div>
            <p className="text-xs text-slate-600 mt-2 mb-4 leading-relaxed">
              This will initialize a new Engineering Change Order in <strong>DRAFT</strong> status linked permanently
              to <strong>{ecr.ecr_number}</strong>. Problem rationale and suggestions will automatically carry over.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                  Target ECO Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={ecoNumber}
                  onChange={(e) => setEcoNumber(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary font-mono font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                    Target Product <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={promoteProductId}
                    onChange={(e) => {
                      setPromoteProductId(e.target.value);
                      setPromoteBomId('');
                    }}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                  >
                    <option value="">Select Product...</option>
                    {products.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.part_number} — {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                    Target BOM <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={promoteBomId}
                    onChange={(e) => setPromoteBomId(e.target.value)}
                    disabled={availableBoms.length === 0}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary bg-white disabled:bg-slate-50"
                  >
                    <option value="">Select BOM...</option>
                    {availableBoms.map((b: any) => (
                      <option key={b.id} value={b.id}>
                        {b.bom_number} (v{b.current_version})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                  Initial Revision Change Summary
                </label>
                <textarea
                  rows={2}
                  value={promoteChangeSummary}
                  onChange={(e) => setPromoteChangeSummary(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button variant="outline" size="sm" onClick={() => setIsPromoteOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  disabled={!ecoNumber.trim() || !promoteProductId || !promoteBomId || promoteMutation.isPending}
                  onClick={() =>
                    promoteMutation.mutate({
                      ecoNumber: ecoNumber.trim(),
                      productId: promoteProductId,
                      bomId: promoteBomId,
                      changeSummary: promoteChangeSummary.trim() || undefined,
                    })
                  }
                >
                  {promoteMutation.isPending ? 'Promoting...' : 'Promote & Open ECO'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Reviewer Modal */}
      {isAssignOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-900 mb-2">Assign Engineering Reviewer</h3>
            <p className="text-xs text-slate-600 mb-4">Select an engineer or reviewer responsible for this request.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                  Assignee <span className="text-rose-500">*</span>
                </label>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                >
                  <option value="">Select Reviewer...</option>
                  {usersList.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.first_name} {u.last_name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button variant="outline" size="sm" onClick={() => setIsAssignOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={!assignedTo || assignMutation.isPending}
                  onClick={() => assignMutation.mutate(assignedTo)}
                >
                  {assignMutation.isPending ? 'Assigning...' : 'Confirm Assignment'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

