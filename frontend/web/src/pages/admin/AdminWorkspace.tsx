import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AdminService } from '../../services';
import { AdminUserItem, AdminRoleItem, SystemHealthData, ActivityLogItem } from '../../types';
import { PageHeader, StatCard, EmptyState } from '../../components/ui/Cards';
import { Button } from '../../components/ui/Button';
import {
  Users,
  Shield,
  Activity,
  HeartPulse,
  UserPlus,
  Power,
  Key,
  Database,
  Cpu,
  Server,
  Layers,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { formatDate } from '../../lib/utils';

export function AdminWorkspace() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'USERS' | 'ROLES' | 'HEALTH' | 'AUDIT'>('USERS');
  const [searchUser, setSearchUser] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    roleIds: [] as string[],
  });

  // Queries
  const { data: usersData, isLoading: loadingUsers } = useQuery({
    queryKey: ['admin', 'users', searchUser],
    queryFn: () => AdminService.listUsers({ search: searchUser || undefined }),
    enabled: activeTab === 'USERS',
  });

  const { data: rolesData, isLoading: loadingRoles } = useQuery<AdminRoleItem[]>({
    queryKey: ['admin', 'roles'],
    queryFn: () => AdminService.listRoles(),
    enabled: activeTab === 'ROLES' || showCreateModal,
  });

  const { data: healthData, isLoading: loadingHealth, refetch: refetchHealth } = useQuery<SystemHealthData>({
    queryKey: ['admin', 'health'],
    queryFn: () => AdminService.getSystemHealth(),
    enabled: activeTab === 'HEALTH',
    refetchInterval: activeTab === 'HEALTH' ? 10000 : false,
  });

  const { data: auditData, isLoading: loadingAudit } = useQuery({
    queryKey: ['admin', 'audit'],
    queryFn: () => AdminService.listAuditLogs({ limit: 50 }),
    enabled: activeTab === 'AUDIT',
  });

  // Mutations
  const createUserMutation = useMutation({
    mutationFn: (data: any) => AdminService.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setShowCreateModal(false);
      setNewUser({ email: '', firstName: '', lastName: '', password: '', roleIds: [] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to create user');
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      AdminService.updateUserStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  const handleToggleStatus = (user: AdminUserItem) => {
    const nextStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    toggleStatusMutation.mutate({ id: user.id, status: nextStatus });
  };

  const users = usersData?.data || [];
  const roles = rolesData || [];
  const auditLogs = auditData?.data || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Administration & Governance"
        description="User authorization, role-based access control, system telemetry, and auditable enterprise logs."
        actions={
          activeTab === 'USERS' ? (
            <Button size="sm" onClick={() => setShowCreateModal(true)} className="gap-2">
              <UserPlus className="w-4 h-4" />
              <span>Add New User</span>
            </Button>
          ) : activeTab === 'HEALTH' ? (
            <Button size="sm" variant="secondary" onClick={() => refetchHealth()} className="gap-2">
              <HeartPulse className="w-4 h-4" />
              <span>Refresh Health</span>
            </Button>
          ) : undefined
        }
      />

      {/* Admin Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('USERS')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 ${
            activeTab === 'USERS'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User Management</span>
        </button>
        <button
          onClick={() => setActiveTab('ROLES')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 ${
            activeTab === 'ROLES'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Roles & Permissions</span>
        </button>
        <button
          onClick={() => setActiveTab('HEALTH')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 ${
            activeTab === 'HEALTH'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <HeartPulse className="w-4 h-4" />
          <span>System Health & DB</span>
        </button>
        <button
          onClick={() => setActiveTab('AUDIT')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 ${
            activeTab === 'AUDIT'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Enterprise Audit Trail</span>
        </button>
      </div>

      {/* Tab 1: User Management */}
      {activeTab === 'USERS' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search users by name or email..."
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Assigned Roles</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Joined</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingUsers ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">Loading users...</td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">No users found</td>
                  </tr>
                ) : (
                  users.map((u: AdminUserItem) => (
                    <tr key={u.id} className="hover:bg-slate-50/70">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {u.firstName} {u.lastName}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">{u.email}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1">
                          {u.roles?.map((r) => (
                            <span
                              key={r.id}
                              className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700"
                            >
                              {r.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            u.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">{formatDate(u.createdAt)}</td>
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleStatus(u)}
                          className={u.status === 'ACTIVE' ? 'text-rose-600 hover:text-rose-700' : 'text-emerald-600 hover:text-emerald-700'}
                        >
                          <Power className="w-3.5 h-3.5 mr-1" />
                          <span>{u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</span>
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Roles & Permissions */}
      {activeTab === 'ROLES' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {roles.map((role) => (
              <div key={role.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900">{role.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
                      {role.userCount} users
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{role.description || 'System role definition'}</p>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Granted Permissions ({role.permissions.length})
                  </div>
                  <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto">
                    {role.permissions.map((perm) => (
                      <span
                        key={perm.id}
                        className="px-2 py-0.5 rounded text-[10px] font-mono bg-teal-50 text-teal-800 border border-teal-100"
                        title={perm.description || perm.code}
                      >
                        {perm.code}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: System Health */}
      {activeTab === 'HEALTH' && healthData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <StatCard
              title="Cluster State"
              value={healthData.status}
              description={healthData.status === 'HEALTHY' ? 'All operational metrics green' : 'Degraded performance'}
              icon={healthData.status === 'HEALTHY' ? CheckCircle2 : AlertCircle}
            />
            <StatCard
              title="PostgreSQL Latency"
              value={`${healthData.database.latencyMs} ms`}
              description="Local roundtrip query time"
              icon={Database}
            />
            <StatCard
              title="Service Uptime"
              value={`${Math.floor(healthData.process.uptimeSeconds / 60)} mins`}
              description={`Node ${healthData.process.nodeVersion} on ${healthData.process.platform}`}
              icon={Server}
            />
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-900">Database Engine Information</h3>
            <div className="p-3 bg-slate-50 rounded-lg font-mono text-xs text-slate-700 border border-slate-200">
              {healthData.database.version}
            </div>

            <h3 className="font-bold text-sm text-slate-900 pt-2">Database Table Record Counts</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-500 block">Products</span>
                <span className="text-base font-bold text-slate-900">{healthData.counts.products}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-500 block">BOMs</span>
                <span className="text-base font-bold text-slate-900">{healthData.counts.boms}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-500 block">ECRs</span>
                <span className="text-base font-bold text-slate-900">{healthData.counts.ecrs}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-500 block">ECOs</span>
                <span className="text-base font-bold text-slate-900">{healthData.counts.ecos}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-500 block">Purchase Orders</span>
                <span className="text-base font-bold text-slate-900">{healthData.counts.purchaseOrders}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-500 block">Work Orders</span>
                <span className="text-base font-bold text-slate-900">{healthData.counts.workOrders}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-500 block">NCRs</span>
                <span className="text-base font-bold text-slate-900">{healthData.counts.ncrs}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-500 block">Audit Logs</span>
                <span className="text-base font-bold text-slate-900">{healthData.counts.auditLogs}</span>
              </div>
            </div>

            <h3 className="font-bold text-sm text-slate-900 pt-2">Process Memory Utilization</h3>
            <div className="grid grid-cols-3 gap-4 text-xs font-mono">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-500 block font-sans">RSS</span>
                <span className="text-sm font-bold text-slate-800">{healthData.process.memory.rssMb} MB</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-500 block font-sans">Heap Total</span>
                <span className="text-sm font-bold text-slate-800">{healthData.process.memory.heapTotalMb} MB</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-500 block font-sans">Heap Used</span>
                <span className="text-sm font-bold text-slate-800">{healthData.process.memory.heapUsedMb} MB</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Audit Logs */}
      {activeTab === 'AUDIT' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 font-bold text-sm text-slate-900">
            Enterprise Audit Logs (Last 50 Events)
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Target Entity</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingAudit ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">Loading audit trail...</td>
                </tr>
              ) : auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">No audit records found</td>
                </tr>
              ) : (
                auditLogs.map((log: ActivityLogItem) => (
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{log.action}</td>
                    <td className="py-3.5 px-4 text-slate-600 font-mono">
                      {log.entityType}: {log.entityId.slice(0, 8)}...
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      {log.user ? `${log.user.name} (${log.user.email})` : 'System'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {log.severity}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">{formatDate(log.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="font-bold text-base text-slate-900 mb-4">Provision Enterprise User</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createUserMutation.mutate(newUser);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block text-slate-600 font-semibold mb-1">First Name</label>
                <input
                  type="text"
                  required
                  value={newUser.firstName}
                  onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Last Name</label>
                <input
                  type="text"
                  required
                  value={newUser.lastName}
                  onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Temporary Password</label>
                <input
                  type="password"
                  required
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Role Assignment</label>
                <select
                  multiple
                  value={newUser.roleIds}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, (option) => option.value);
                    setNewUser({ ...newUser, roleIds: selected });
                  }}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary h-24"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} - {r.description}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 mt-1 block">Hold Ctrl/Cmd to select multiple</span>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={createUserMutation.isPending}>
                  {createUserMutation.isPending ? 'Provisioning...' : 'Provision User'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

