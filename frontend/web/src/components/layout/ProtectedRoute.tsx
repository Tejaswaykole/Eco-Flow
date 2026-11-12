import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { RoleName } from '../../types';
import { AccessDenied } from '../../pages/error/AccessDenied';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: RoleName;
  requiredPermission?: string;
}

export function ProtectedRoute({ children, requiredRole, requiredPermission }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, hasRole, hasPermission } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400 text-sm">
        Verifying secure workspace session...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole && !hasRole(requiredRole) && !hasRole('ADMINISTRATOR')) {
    return <AccessDenied requiredRole={requiredRole} />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <AccessDenied requiredPermission={requiredPermission} />;
  }

  return <>{children}</>;
}
