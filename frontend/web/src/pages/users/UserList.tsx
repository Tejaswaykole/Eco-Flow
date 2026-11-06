import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { UserService } from '../../services';
import { PageHeader, EmptyState } from '../../components/ui/Cards';
import { Users, Shield } from 'lucide-react';
import { formatDate } from '../../lib/utils';

export function UserList() {
  const { data: usersData, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => UserService.listUsers(1, 50),
  });

  const users = usersData?.data || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Accounts & Role Permissions"
        description="Enterprise users, primary roles, and authorization capabilities."
      />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading user accounts...</div>
        ) : users.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No users found"
            description="Accounts registered in ECOFlow will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Email Address</th>
                  <th className="py-3 px-4">Primary Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Joined Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const primaryRole = u.user_roles?.find((r: any) => r.is_primary)?.role?.name || 'OPERATOR';
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {u.first_name} {u.last_name}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">{u.email}</td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px]">
                          <Shield className="w-3 h-3 text-primary" />
                          <span>{primaryRole}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {u.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">{formatDate(u.created_at)}</td>
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

