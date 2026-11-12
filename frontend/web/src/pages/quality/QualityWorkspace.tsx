import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QualityService, ProductService } from '../../services';
import { PageHeader, EmptyState } from '../../components/ui/Cards';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badges';
import { ShieldAlert, Plus, Search, CheckCircle, AlertOctagon, X, FileCheck, ClipboardList } from 'lucide-react';
import { formatDate } from '../../lib/utils';
import { QualityInspection, QualityNonConformance } from '../../types';
import { useAuth } from '../../context/AuthContext';

export function QualityWorkspace() {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<'INSPECTIONS' | 'NCRS'>('INSPECTIONS');
  const [search, setSearch] = useState('');

  // Modals
  const [isNewInspectionOpen, setIsNewInspectionOpen] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<QualityInspection | null>(null);
  const [isResultOpen, setIsResultOpen] = useState(false);

  const [isNewNCROpen, setIsNewNCROpen] = useState(false);
  const [selectedNCR, setSelectedNCR] = useState<QualityNonConformance | null>(null);
  const [isUpdateNCROpen, setIsUpdateNCROpen] = useState(false);

  // New Inspection Form
  const [inspType, setInspType] = useState('RECEIVING');
  const [inspProductId, setInspProductId] = useState('');
  const [sampleSize, setSampleSize] = useState('10');
  const [inspNotes, setInspNotes] = useState('');
  const [inspError, setInspError] = useState<string | null>(null);

  // Record Result Form
  const [passedQty, setPassedQty] = useState('10');
  const [failedQty, setFailedQty] = useState('0');
  const [inspStatus, setInspStatus] = useState('PASSED');
  const [resultNotes, setResultNotes] = useState('');
  const [resultError, setResultError] = useState<string | null>(null);

  // New NCR Form
  const [ncrProductId, setNcrProductId] = useState('');
  const [severity, setSeverity] = useState('MAJOR');
  const [ncrTitle, setNcrTitle] = useState('');
  const [ncrDesc, setNcrDesc] = useState('');
  const [ncrError, setNcrError] = useState<string | null>(null);

  // Update NCR Form
  const [updateStatus, setUpdateStatus] = useState('UNDER_INVESTIGATION');
  const [rootCause, setRootCause] = useState('');
  const [disposition, setDisposition] = useState('');
  const [capaPlan, setCapaPlan] = useState('');
  const [updateNCRError, setUpdateNCRError] = useState<string | null>(null);

  const { data: productsData } = useQuery({
    queryKey: ['products-dropdown'],
    queryFn: () => ProductService.listProducts(1, 100),
  });
  const products = productsData?.data || [];

  const { data: inspections = [], isLoading: isInspLoading } = useQuery({
    queryKey: ['quality-inspections'],
    queryFn: () => QualityService.listInspections(),
  });

  const { data: ncrs = [], isLoading: isNCRLoading } = useQuery({
    queryKey: ['quality-ncrs'],
    queryFn: () => QualityService.listNCRs(),
  });

  const createInspMutation = useMutation({
    mutationFn: QualityService.createInspection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quality-inspections'] });
      setIsNewInspectionOpen(false);
      setInspProductId('');
      setSampleSize('10');
      setInspNotes('');
      setInspError(null);
    },
    onError: (err: any) => {
      setInspError(err.response?.data?.error?.message || 'Failed to create inspection');
    },
  });

  const recordResultMutation = useMutation({
    mutationFn: (data: any) => QualityService.recordResult(selectedInspection!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quality-inspections'] });
      setIsResultOpen(false);
      setSelectedInspection(null);
      setResultError(null);
    },
    onError: (err: any) => {
      setResultError(err.response?.data?.error?.message || 'Failed to record inspection result');
    },
  });

  const createNCRMutation = useMutation({
    mutationFn: QualityService.createNCR,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quality-ncrs'] });
      setIsNewNCROpen(false);
      setNcrProductId('');
      setNcrTitle('');
      setNcrDesc('');
      setNcrError(null);
    },
    onError: (err: any) => {
      setNcrError(err.response?.data?.error?.message || 'Failed to raise NCR');
    },
  });

  const updateNCRMutation = useMutation({
    mutationFn: (data: any) => QualityService.updateNCR(selectedNCR!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quality-ncrs'] });
      setIsUpdateNCROpen(false);
      setSelectedNCR(null);
      setUpdateNCRError(null);
    },
    onError: (err: any) => {
      setUpdateNCRError(err.response?.data?.error?.message || 'Failed to update NCR');
    },
  });

  const openResultModal = (insp: QualityInspection) => {
    setSelectedInspection(insp);
    setSampleSize(String(insp.sample_size));
    setPassedQty(String(insp.sample_size));
    setFailedQty('0');
    setInspStatus('PASSED');
    setResultNotes('');
    setIsResultOpen(true);
  };

  const openUpdateNCRModal = (ncr: QualityNonConformance) => {
    setSelectedNCR(ncr);
    setUpdateStatus(ncr.status);
    setRootCause(ncr.root_cause || '');
    setDisposition(ncr.disposition || '');
    setCapaPlan(ncr.capa_plan || '');
    setIsUpdateNCROpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quality Assurance & Compliance"
        description="Receiving, in-process and final inspections, non-conformance tracking (NCR), and corrective actions (CAPA)."
      >
        <div className="flex gap-2">
          {activeTab === 'INSPECTIONS' ? (
            hasPermission('quality:inspect') && (
              <Button size="sm" onClick={() => setIsNewInspectionOpen(true)}>
                <Plus className="w-4 h-4 mr-1.5" />
                <span>New Inspection</span>
              </Button>
            )
          ) : (
            hasPermission('quality:write') && (
              <Button size="sm" variant="outline" className="border-rose-300 text-rose-700 hover:bg-rose-50" onClick={() => setIsNewNCROpen(true)}>
                <AlertOctagon className="w-4 h-4 mr-1.5" />
                <span>Raise NCR</span>
              </Button>
            )
          )}
        </div>
      </PageHeader>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('INSPECTIONS')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'INSPECTIONS'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Inspections ({inspections.length})
        </button>
        <button
          onClick={() => setActiveTab('NCRS')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'NCRS'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Non-Conformance Reports (NCR) ({ncrs.length})
        </button>
      </div>

      {activeTab === 'INSPECTIONS' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {isInspLoading ? (
            <div className="p-8 text-center text-sm text-slate-500">Loading inspections...</div>
          ) : inspections.length === 0 ? (
            <div className="p-8 text-center">
              <EmptyState
                icon={FileCheck}
                title="No quality inspections logged"
                description="Create inspections for receiving goods, in-process sub-assemblies, or final production sign-offs."
                action={
                  hasPermission('quality:inspect') ? (
                    <Button size="sm" onClick={() => setIsNewInspectionOpen(true)}>
                      Log Inspection
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3">Inspection #</th>
                    <th className="px-6 py-3">Type</th>
                    <th className="px-6 py-3">Product</th>
                    <th className="px-6 py-3 text-right">Sample Size</th>
                    <th className="px-6 py-3 text-right">Passed</th>
                    <th className="px-6 py-3 text-right">Failed</th>
                    <th className="px-6 py-3 text-center">Status</th>
                    <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inspections.map((insp) => (
                    <tr key={insp.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-3.5 font-mono font-medium text-slate-900">{insp.inspection_number}</td>
                      <td className="px-6 py-3.5 font-medium text-xs text-slate-700">{insp.type}</td>
                      <td className="px-6 py-3.5 font-mono text-xs">{insp.product?.part_number || '—'}</td>
                      <td className="px-6 py-3.5 text-right font-mono">{Number(insp.sample_size)}</td>
                      <td className="px-6 py-3.5 text-right font-mono font-medium text-emerald-700">{Number(insp.passed_quantity)}</td>
                      <td className="px-6 py-3.5 text-right font-mono font-medium text-rose-700">{Number(insp.failed_quantity)}</td>
                      <td className="px-6 py-3.5 text-center">
                        <StatusBadge status={insp.status} />
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        {['PENDING', 'IN_PROGRESS'].includes(insp.status) && hasPermission('quality:inspect') && (
                          <Button size="sm" variant="outline" onClick={() => openResultModal(insp)}>
                            Record Result
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'NCRS' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {isNCRLoading ? (
            <div className="p-8 text-center text-sm text-slate-500">Loading non-conformance records...</div>
          ) : ncrs.length === 0 ? (
            <div className="p-8 text-center">
              <EmptyState
                icon={ShieldAlert}
                title="No active Non-Conformances"
                description="Zero quality defects recorded. Any component out-of-tolerance can be logged here."
                action={
                  hasPermission('quality:write') ? (
                    <Button size="sm" onClick={() => setIsNewNCROpen(true)}>
                      Raise NCR
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3">NCR #</th>
                    <th className="px-6 py-3">Severity</th>
                    <th className="px-6 py-3">Product</th>
                    <th className="px-6 py-3">Defect Title</th>
                    <th className="px-6 py-3 text-center">Status</th>
                    <th className="px-6 py-3">Created</th>
                    <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ncrs.map((ncr) => (
                    <tr key={ncr.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-3.5 font-mono font-medium text-slate-900">{ncr.ncr_number}</td>
                      <td className="px-6 py-3.5">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${
                            ncr.severity === 'CRITICAL'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : ncr.severity === 'MAJOR'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}
                        >
                          {ncr.severity}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 font-mono text-xs">{ncr.product?.part_number || '—'}</td>
                      <td className="px-6 py-3.5 font-medium text-slate-800">{ncr.title}</td>
                      <td className="px-6 py-3.5 text-center">
                        <StatusBadge status={ncr.status} />
                      </td>
                      <td className="px-6 py-3.5 text-xs text-slate-500">{formatDate(ncr.created_at)}</td>
                      <td className="px-6 py-3.5 text-right">
                        {hasPermission('quality:decide') && (
                          <Button size="sm" variant="outline" onClick={() => openUpdateNCRModal(ncr)}>
                            Investigate / CAPA
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* New Inspection Modal */}
      {isNewInspectionOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Initiate Quality Inspection</h3>
              <button onClick={() => setIsNewInspectionOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createInspMutation.mutate({
                  type: inspType,
                  productId: inspProductId,
                  sampleSize: Number(sampleSize),
                  notes: inspNotes || undefined,
                });
              }}
              className="p-6 space-y-4"
            >
              {inspError && <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">{inspError}</div>}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Inspection Type *</label>
                <select
                  value={inspType}
                  onChange={(e) => setInspType(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                >
                  <option value="RECEIVING">Receiving Inspection (Incoming Goods)</option>
                  <option value="IN_PROCESS">In-Process Inspection</option>
                  <option value="FINAL">Final Acceptance Inspection</option>
                  <option value="FIRST_ARTICLE">First Article Inspection (FAI)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Product *</label>
                <select
                  required
                  value={inspProductId}
                  onChange={(e) => setInspProductId(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                >
                  <option value="">Select product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.part_number} — {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Sample Size *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={sampleSize}
                  onChange={(e) => setSampleSize(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Scope & Sampling Plan</label>
                <textarea
                  rows={2}
                  placeholder="AQL tolerance, measurement dimensions..."
                  value={inspNotes}
                  onChange={(e) => setInspNotes(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={() => setIsNewInspectionOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createInspMutation.isPending}>
                  {createInspMutation.isPending ? 'Logging...' : 'Create Inspection'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Result Modal */}
      {isResultOpen && selectedInspection && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-900">Record Inspection Results</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{selectedInspection.inspection_number}</p>
              </div>
              <button onClick={() => setIsResultOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                recordResultMutation.mutate({
                  passedQuantity: Number(passedQty),
                  failedQuantity: Number(failedQty),
                  status: inspStatus,
                  notes: resultNotes || undefined,
                });
              }}
              className="p-6 space-y-4"
            >
              {resultError && <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">{resultError}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Passed Qty *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={passedQty}
                    onChange={(e) => setPassedQty(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Failed Qty *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={failedQty}
                    onChange={(e) => {
                      const f = e.target.value;
                      setFailedQty(f);
                      if (Number(f) > 0) setInspStatus('FAILED');
                      else setInspStatus('PASSED');
                    }}
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Verdict Decision *</label>
                <select
                  value={inspStatus}
                  onChange={(e) => setInspStatus(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                >
                  <option value="PASSED">PASSED (Full Acceptance)</option>
                  <option value="FAILED">FAILED (Non-Conformance Triggered)</option>
                  <option value="CONDITIONALLY_PASSED">CONDITIONALLY PASSED (Minor Deviation)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Inspection Findings</label>
                <textarea
                  rows={2}
                  placeholder="Measurement observations, gage IDs..."
                  value={resultNotes}
                  onChange={(e) => setResultNotes(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={() => setIsResultOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={recordResultMutation.isPending}>
                  {recordResultMutation.isPending ? 'Saving...' : 'Record Verdict'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New NCR Modal */}
      {isNewNCROpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Raise Non-Conformance Report (NCR)</h3>
              <button onClick={() => setIsNewNCROpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createNCRMutation.mutate({
                  productId: ncrProductId,
                  severity,
                  title: ncrTitle,
                  description: ncrDesc,
                });
              }}
              className="p-6 space-y-4"
            >
              {ncrError && <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">{ncrError}</div>}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Defective Product *</label>
                <select
                  required
                  value={ncrProductId}
                  onChange={(e) => setNcrProductId(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                >
                  <option value="">Select product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.part_number} — {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Defect Severity *</label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                >
                  <option value="MINOR">MINOR (Aesthetic / Non-critical dimension)</option>
                  <option value="MAJOR">MAJOR (Form, fit or function impact)</option>
                  <option value="CRITICAL">CRITICAL (Safety, legal, or batch hazard)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Defect Summary / Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PCB solder bridge on connector J2"
                  value={ncrTitle}
                  onChange={(e) => setNcrTitle(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Detailed Description *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe non-conformance, lot number, and observed defect..."
                  value={ncrDesc}
                  onChange={(e) => setNcrDesc(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={() => setIsNewNCROpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createNCRMutation.isPending}>
                  {createNCRMutation.isPending ? 'Logging...' : 'File NCR'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Investigate / CAPA Modal */}
      {isUpdateNCROpen && selectedNCR && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-900">NCR Investigation & CAPA</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{selectedNCR.ncr_number} — {selectedNCR.title}</p>
              </div>
              <button onClick={() => setIsUpdateNCROpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateNCRMutation.mutate({
                  status: updateStatus,
                  rootCause: rootCause || undefined,
                  disposition: disposition || undefined,
                  capaPlan: capaPlan || undefined,
                });
              }}
              className="p-6 space-y-4"
            >
              {updateNCRError && <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">{updateNCRError}</div>}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">NCR Workflow Status *</label>
                <select
                  value={updateStatus}
                  onChange={(e) => setUpdateStatus(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                >
                  <option value="OPEN">OPEN</option>
                  <option value="UNDER_INVESTIGATION">UNDER INVESTIGATION</option>
                  <option value="CAPA_REQUIRED">CAPA REQUIRED</option>
                  <option value="CLOSED">CLOSED (Resolved)</option>
                  <option value="REJECTED">REJECTED (Invalid)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Root Cause Analysis (5-Why / Fishbone)</label>
                <textarea
                  rows={2}
                  placeholder="Root cause identified..."
                  value={rootCause}
                  onChange={(e) => setRootCause(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Immediate Material Disposition</label>
                <textarea
                  rows={2}
                  placeholder="Rework, Scrap, or Return to Vendor..."
                  value={disposition}
                  onChange={(e) => setDisposition(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Corrective & Preventive Action (CAPA) Plan</label>
                <textarea
                  rows={2}
                  placeholder="Process changes or tooling updates to prevent recurrence..."
                  value={capaPlan}
                  onChange={(e) => setCapaPlan(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={() => setIsUpdateNCROpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateNCRMutation.isPending}>
                  {updateNCRMutation.isPending ? 'Updating...' : 'Save Resolution'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
