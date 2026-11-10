import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ECNService, ProductService } from '../../services';
import { Button } from '../../components/ui/Button';
import { StatusBadge, DepartmentBadge, DispositionTypeBadge } from '../../components/ui/Badges';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../lib/utils';
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  Layers,
  Box,
  User,
  AlertTriangle,
  GitPullRequest,
  Check,
  Send,
  Plus,
  X,
  ExternalLink,
  ShieldCheck,
  HelpCircle,
  FileCheck,
} from 'lucide-react';

export function ECNDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user, hasRole, hasPermission } = useAuth();

  // Dialog States
  const [isAcknowledgeOpen, setIsAcknowledgeOpen] = useState(false);
  const [selectedDistId, setSelectedDistId] = useState<string | null>(null);
  const [selectedDeptName, setSelectedDeptName] = useState<string>('');
  const [ackComments, setAckComments] = useState('');

  const [isDispositionOpen, setIsDispositionOpen] = useState(false);
  const [dispPartNumber, setDispPartNumber] = useState('');
  const [dispType, setDispType] = useState('SCRAP');
  const [dispQuantity, setDispQuantity] = useState('');
  const [dispInstructions, setDispInstructions] = useState('');
  const [dispDepartment, setDispDepartment] = useState('PRODUCTION');

  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');

  const [actionError, setActionError] = useState<string | null>(null);

  // Load ECN
  const {
    data: ecn,
    isLoading,
    error: loadError,
  } = useQuery({
    queryKey: ['ecn', id],
    queryFn: () => ECNService.getECN(id!),
    enabled: !!id,
  });

  // Supporting query for products
  const { data: productsData } = useQuery({
    queryKey: ['products-disp-select'],
    queryFn: () => ProductService.listProducts(1, 100),
    enabled: isDispositionOpen,
  });

  const products = productsData?.data || [];

  const isEngineerOrAdmin =
    hasRole('ADMINISTRATOR') ||
    hasRole('LEAD_ENGINEER') ||
    hasPermission('ecn:issue') ||
    hasPermission('admin:all');

  const handleMutationSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['ecn', id] });
    queryClient.invalidateQueries({ queryKey: ['ecns'] });
    setActionError(null);
  };

  // Mutations
  const issueMutation = useMutation({
    mutationFn: () => ECNService.issueECN(id!),
    onSuccess: handleMutationSuccess,
    onError: (err: any) => setActionError(err.response?.data?.error?.message || 'Failed to issue ECN'),
  });

  const completeMutation = useMutation({
    mutationFn: () => ECNService.completeECN(id!),
    onSuccess: handleMutationSuccess,
    onError: (err: any) => setActionError(err.response?.data?.error?.message || 'Failed to complete ECN'),
  });

  const cancelMutation = useMutation({
    mutationFn: (reason: string) => ECNService.cancelECN(id!, reason),
    onSuccess: () => {
      handleMutationSuccess();
      setIsCancelOpen(false);
      setCancellationReason('');
    },
    onError: (err: any) => setActionError(err.response?.data?.error?.message || 'Failed to cancel ECN'),
  });

  const acknowledgeMutation = useMutation({
    mutationFn: ({ distId, comments }: { distId: string; comments?: string }) =>
      ECNService.acknowledgeDistribution(id!, distId, comments),
    onSuccess: () => {
      handleMutationSuccess();
      setIsAcknowledgeOpen(false);
      setSelectedDistId(null);
      setAckComments('');
    },
    onError: (err: any) =>
      setActionError(err.response?.data?.error?.message || 'Failed to acknowledge department distribution'),
  });

  const addDispositionMutation = useMutation({
    mutationFn: (payload: any) => ECNService.addDisposition(id!, payload),
    onSuccess: () => {
      handleMutationSuccess();
      setIsDispositionOpen(false);
      setDispPartNumber('');
      setDispType('SCRAP');
      setDispQuantity('');
      setDispInstructions('');
      setDispDepartment('PRODUCTION');
    },
    onError: (err: any) =>
      setActionError(err.response?.data?.error?.message || 'Failed to add material disposition'),
  });

  if (isLoading) {
    return (
      <div className="p-12 text-center text-sm text-slate-500">
        <Bell className="w-8 h-8 animate-pulse text-primary mx-auto mb-3" />
        Loading change notice details...
      </div>
    );
  }

  if (loadError || !ecn) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-base font-bold text-slate-800">Change Notice Not Found</h2>
        <p className="text-xs text-slate-500">
          The requested notice does not exist or you do not have permission to view it.
        </p>
        <Link to="/ecns">
          <Button variant="outline" size="sm">
            Back to Change Notices
          </Button>
        </Link>
      </div>
    );
  }

  const distributions = ecn.distributions || [];
  const dispositions = ecn.dispositions || [];
  const ackCount = distributions.filter((d: any) => d.acknowledgement_status === 'ACKNOWLEDGED').length;
  const totalDists = distributions.length;
  const isAllAcknowledged = totalDists > 0 && ackCount === totalDists;

  return (
    <div className="space-y-6">
      {/* Top Header & Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/ecns" className="text-slate-400 hover:text-slate-700 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-slate-500">{ecn.ecn_number}</span>
              <StatusBadge status={ecn.status} />
              <div className="flex items-center gap-1 text-xs text-slate-500 ml-2">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Effective: {formatDate(ecn.effective_date)}</span>
              </div>
            </div>
            <h1 className="text-xl font-bold text-slate-900 mt-1">{ecn.title}</h1>
          </div>
        </div>

        {/* Top Action Controls */}
        <div className="flex items-center gap-2">
          {ecn.status === 'DRAFT' && isEngineerOrAdmin && (
            <>
              <Button
                size="sm"
                className="bg-primary hover:bg-primary-hover text-white"
                disabled={issueMutation.isPending}
                onClick={() => issueMutation.mutate()}
              >
                <Send className="w-4 h-4 mr-1.5" />
                <span>{issueMutation.isPending ? 'Issuing...' : 'Issue ECN'}</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                onClick={() => {
                  setCancellationReason('');
                  setIsCancelOpen(true);
                }}
              >
                <XCircle className="w-4 h-4 mr-1.5" />
                <span>Cancel ECN</span>
              </Button>
            </>
          )}

          {ecn.status === 'ISSUED' && isEngineerOrAdmin && (
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={completeMutation.isPending}
              onClick={() => completeMutation.mutate()}
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              <span>{completeMutation.isPending ? 'Completing...' : 'Mark Completed'}</span>
            </Button>
          )}

          {ecn.eco && (
            <Link to={`/ecos/${ecn.eco.id}`}>
              <Button variant="outline" size="sm">
                <GitPullRequest className="w-4 h-4 mr-1.5 text-slate-500" />
                <span>Source ECO</span>
              </Button>
            </Link>
          )}
        </div>
      </div>

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

      {/* Cancellation Notice Banner (if cancelled) */}
      {ecn.status === 'CANCELLED' && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-900">
          <div className="flex items-center gap-2 font-bold text-sm text-rose-800 mb-1">
            <XCircle className="w-4 h-4 text-rose-600" />
            <span>Change Notice Cancelled</span>
          </div>
          <p className="text-xs text-rose-700 leading-relaxed">
            <strong>Reason:</strong> {ecn.cancellation_reason || 'No cancellation reason specified.'}
          </p>
        </div>
      )}

      {/* Completed Notice Banner (if completed) */}
      {ecn.status === 'COMPLETED' && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-emerald-950">Notice Distribution Completed</div>
            <div className="text-xs text-emerald-700 mt-0.5">
              All target departments have acknowledged receipt and disposition instructions.
            </div>
          </div>
        </div>
      )}

      {/* Released Version Context Banner */}
      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <FileCheck className="w-4 h-4 text-teal-600" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Released Product & BOM Reference</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div className="text-slate-500 font-semibold mb-1">Released Product Version</div>
            <div className="font-mono text-slate-900 font-bold flex items-center gap-1.5">
              <Box className="w-3.5 h-3.5 text-primary" />
              <span>
                {ecn.version_release?.product?.part_number || ecn.eco?.product?.part_number || 'Product'} (v
                {ecn.version_release?.product_version?.version_number ?? '—'})
              </span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div className="text-slate-500 font-semibold mb-1">Released BOM Version</div>
            <div className="font-mono text-slate-900 font-bold flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-teal-600" />
              <span>
                {ecn.eco?.bom?.bom_number || 'BOM'} (v
                {ecn.version_release?.bom_version?.version_number ?? '—'})
              </span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div className="text-slate-500 font-semibold mb-1">Release Author & Date</div>
            <div className="text-slate-800 font-medium flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>
                {ecn.version_release?.releaser
                  ? `${ecn.version_release.releaser.first_name} ${ecn.version_release.releaser.last_name}`
                  : 'System'}{' '}
                • {formatDate(ecn.version_release?.released_at || ecn.created_at)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Details & Distribution (2 cols left, 1 col right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Change Details & Dispositions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Change Summary Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">Change Summary</h3>
            <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">{ecn.change_summary}</p>

            {ecn.reason_for_change && (
              <div className="pt-4 border-t border-slate-100">
                <h4 className="text-xs font-semibold uppercase text-slate-600 mb-1">Reason for Engineering Change</h4>
                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{ecn.reason_for_change}</p>
              </div>
            )}
          </div>

          {/* Department Distributions Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                  Department Distribution & Acknowledgements
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Operating departments must formally acknowledge notice receipt and disposition instructions.
                </p>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                  isAllAcknowledged
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {ackCount} / {totalDists} Acknowledged
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {distributions.map((dist: any) => {
                const isAck = dist.acknowledgement_status === 'ACKNOWLEDGED';
                const canAcknowledgeThis =
                  ecn.status === 'ISSUED' &&
                  !isAck &&
                  (isEngineerOrAdmin ||
                    hasPermission('ecn:acknowledge') ||
                    dist.assigned_to === user?.id);

                return (
                  <div key={dist.id} className="py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <DepartmentBadge department={dist.department} />
                        <StatusBadge status={dist.acknowledgement_status} />
                      </div>
                      {isAck ? (
                        <div className="text-[11px] text-slate-500">
                          Acknowledged by{' '}
                          <strong className="text-slate-700">
                            {dist.acknowledger
                              ? `${dist.acknowledger.first_name} ${dist.acknowledger.last_name}`
                              : 'Authorized Representative'}
                          </strong>{' '}
                          on {formatDate(dist.acknowledged_at)}
                          {dist.comments && (
                            <div className="mt-1 p-2 bg-slate-50 rounded border border-slate-100 text-slate-600 italic">
                              "{dist.comments}"
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400 italic">
                          Pending acknowledgement from {dist.department.toLowerCase()} team
                        </div>
                      )}
                    </div>

                    {canAcknowledgeThis && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedDistId(dist.id);
                          setSelectedDeptName(dist.department);
                          setAckComments('');
                          setIsAcknowledgeOpen(true);
                        }}
                      >
                        <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                        <span>Acknowledge</span>
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Material Dispositions Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">Material Disposition Instructions</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Actionable instructions for WIP, inventory, and supplier materials affected by this release.
                </p>
              </div>
              {isEngineerOrAdmin && ecn.status !== 'CANCELLED' && (
                <Button size="sm" variant="outline" onClick={() => setIsDispositionOpen(true)}>
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  <span>Add Disposition</span>
                </Button>
              )}
            </div>

            {dispositions.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No material dispositions specified for this notice.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {dispositions.map((disp: any) => (
                  <div key={disp.id} className="py-3.5 space-y-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <DispositionTypeBadge type={disp.disposition_type} />
                        <span className="font-mono font-bold text-slate-800">
                          {disp.part_number || disp.product?.part_number || 'General Material'}
                        </span>
                        {disp.quantity && (
                          <span className="text-slate-500 font-semibold">Qty: {disp.quantity}</span>
                        )}
                      </div>
                      <DepartmentBadge department={disp.responsible_department} />
                    </div>
                    <p className="text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100 leading-relaxed whitespace-pre-wrap">
                      {disp.instructions}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Notice Metadata Panel */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4 text-xs">
            <h3 className="font-bold uppercase tracking-wider text-slate-700">Notice Details</h3>

            <div className="space-y-3 divide-y divide-slate-100">
              <div className="flex items-center justify-between pt-2">
                <span className="text-slate-500">Notice Status</span>
                <StatusBadge status={ecn.status} />
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-slate-500">Effective Date</span>
                <span className="font-semibold text-slate-800">{formatDate(ecn.effective_date)}</span>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-slate-500">Source ECO #</span>
                {ecn.eco ? (
                  <Link to={`/ecos/${ecn.eco.id}`} className="font-mono font-bold text-primary hover:underline">
                    {ecn.eco.eco_number}
                  </Link>
                ) : (
                  '—'
                )}
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-slate-500">Created By</span>
                <span className="font-medium text-slate-800">
                  {ecn.creator ? `${ecn.creator.first_name} ${ecn.creator.last_name}` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-slate-500">Created Date</span>
                <span className="text-slate-700">{formatDate(ecn.created_at)}</span>
              </div>
              {ecn.issued_at && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-slate-500">Issued Date</span>
                  <span className="text-slate-700">{formatDate(ecn.issued_at)}</span>
                </div>
              )}
              {ecn.issuer && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-slate-500">Issued By</span>
                  <span className="font-medium text-slate-800">
                    {ecn.issuer.first_name} {ecn.issuer.last_name}
                  </span>
                </div>
              )}
              {ecn.completed_at && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-slate-500">Completed Date</span>
                  <span className="text-emerald-700 font-semibold">{formatDate(ecn.completed_at)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Acknowledgement Instructions Card */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
            <div className="flex items-center gap-2 font-semibold text-slate-700">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Acknowledgement Governance</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Acknowledging receipt confirms that your operating department has reviewed the released revision and
              accepted responsibility for executing the material dispositions.
            </p>
          </div>
        </div>
      </div>

      {/* Acknowledge Distribution Modal */}
      {isAcknowledgeOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-900 mb-2">Acknowledge Notice Receipt</h3>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Record formal sign-off for the <strong>{selectedDeptName}</strong> department.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                  Optional Sign-Off Notes / Transition Plan
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Reviewed line tooling; rework fixture scheduled for Shift 2."
                  value={ackComments}
                  onChange={(e) => setAckComments(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button variant="outline" size="sm" onClick={() => setIsAcknowledgeOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={acknowledgeMutation.isPending}
                  onClick={() =>
                    acknowledgeMutation.mutate({
                      distId: selectedDistId!,
                      comments: ackComments.trim() || undefined,
                    })
                  }
                >
                  {acknowledgeMutation.isPending ? 'Confirming...' : 'Confirm Sign-Off'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Material Disposition Modal */}
      {isDispositionOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-900 mb-2">Add Material Disposition</h3>
            <p className="text-xs text-slate-600 mb-4">
              Specify disposition instructions for affected materials (scrap, rework, or use as is).
            </p>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                    Disposition Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={dispType}
                    onChange={(e) => setDispType(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                  >
                    <option value="SCRAP">SCRAP (Must not be used)</option>
                    <option value="REWORK">REWORK (Requires modification)</option>
                    <option value="USE_AS_IS">USE_AS_IS (Approved for usage)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                    Responsible Department <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={dispDepartment}
                    onChange={(e) => setDispDepartment(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                  >
                    <option value="PRODUCTION">Production</option>
                    <option value="QUALITY">Quality</option>
                    <option value="INVENTORY">Inventory</option>
                    <option value="PROCUREMENT">Procurement</option>
                    <option value="ENGINEERING">Engineering</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                    Part Number / Component
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. BRKT-CHS-001"
                    value={dispPartNumber}
                    onChange={(e) => setDispPartNumber(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                    Estimated Quantity (Optional)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 50"
                    value={dispQuantity}
                    onChange={(e) => setDispQuantity(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                  Specific Disposition Instructions <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Detailed instructions for line quarantine, drill modification, or scrapping scrap bins..."
                  value={dispInstructions}
                  onChange={(e) => setDispInstructions(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button variant="outline" size="sm" onClick={() => setIsDispositionOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={!dispInstructions.trim() || addDispositionMutation.isPending}
                  onClick={() =>
                    addDispositionMutation.mutate({
                      partNumber: dispPartNumber.trim() || undefined,
                      dispositionType: dispType,
                      quantity: dispQuantity ? Number(dispQuantity) : undefined,
                      instructions: dispInstructions.trim(),
                      responsibleDepartment: dispDepartment,
                    })
                  }
                >
                  {addDispositionMutation.isPending ? 'Recording...' : 'Record Disposition'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel ECN Modal */}
      {isCancelOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-900 mb-2">Cancel Engineering Change Notice</h3>
            <p className="text-xs text-slate-600 mb-4">
              Cancelling a draft ECN prevents it from being issued. A non-empty cancellation reason is mandatory.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                  Mandatory Cancellation Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Explain why this notice was cancelled..."
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button variant="outline" size="sm" onClick={() => setIsCancelOpen(false)}>
                  Go Back
                </Button>
                <Button
                  size="sm"
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                  disabled={!cancellationReason.trim() || cancelMutation.isPending}
                  onClick={() => cancelMutation.mutate(cancellationReason.trim())}
                >
                  {cancelMutation.isPending ? 'Cancelling...' : 'Confirm Cancellation'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

