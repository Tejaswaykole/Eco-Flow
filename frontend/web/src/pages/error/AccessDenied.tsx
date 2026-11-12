import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Home, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface AccessDeniedProps {
  requiredRole?: string;
  requiredPermission?: string;
}

export function AccessDenied({ requiredRole, requiredPermission }: AccessDeniedProps) {
  const { user } = useAuth();

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-xl p-8 text-center">
        <div className="w-16 h-16 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-center mx-auto mb-5 text-rose-600 shadow-sm">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <span className="inline-block px-3 py-1 bg-rose-100 text-rose-800 text-xs font-bold rounded-full mb-3 tracking-wide">
          HTTP 403 &bull; FORBIDDEN
        </span>

        <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
        <p className="text-sm text-slate-600 mb-6">
          Your active account does not have sufficient authorization or the necessary role permissions to access this workspace.
        </p>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left text-xs mb-6 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-medium">Signed in as:</span>
            <span className="font-semibold text-slate-800">{user?.email || 'Authenticated User'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-medium">Assigned Role:</span>
            <span className="inline-block px-2 py-0.5 bg-slate-200 text-slate-800 rounded font-mono text-[11px]">
              {user?.roles?.[0] || 'NONE'}
            </span>
          </div>
          {requiredPermission && (
            <div className="flex justify-between items-center pt-1 border-t border-slate-200">
              <span className="text-slate-500 font-medium">Missing Permission:</span>
              <span className="font-mono text-rose-600 font-semibold">{requiredPermission}</span>
            </div>
          )}
          {requiredRole && (
            <div className="flex justify-between items-center pt-1 border-t border-slate-200">
              <span className="text-slate-500 font-medium">Required Role:</span>
              <span className="font-mono text-rose-600 font-semibold">{requiredRole}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary-dark transition-colors shadow-sm"
          >
            <Home className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </Link>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go Back</span>
          </button>
        </div>
      </div>
    </div>
  );
}

