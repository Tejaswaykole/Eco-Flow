import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { Login } from './pages/auth/Login';
import { Register } from './pages/auth/Register';
import { Loader2 } from 'lucide-react';

// Lazy-loaded route components for optimized bundle splitting
const Dashboard = lazy(() => import('./pages/dashboard/Dashboard').then((m) => ({ default: m.Dashboard })));
const ProductsList = lazy(() => import('./pages/products/ProductsList').then((m) => ({ default: m.ProductsList })));
const ProductDetail = lazy(() => import('./pages/products/ProductDetail').then((m) => ({ default: m.ProductDetail })));
const CategoriesList = lazy(() => import('./pages/categories/CategoriesList').then((m) => ({ default: m.CategoriesList })));
const BOMList = lazy(() => import('./pages/boms/BOMList').then((m) => ({ default: m.BOMList })));
const BOMDetail = lazy(() => import('./pages/boms/BOMDetail').then((m) => ({ default: m.BOMDetail })));
const ECOList = lazy(() => import('./pages/ecos/ECOList').then((m) => ({ default: m.ECOList })));
const ECODetail = lazy(() => import('./pages/ecos/ECODetail').then((m) => ({ default: m.ECODetail })));
const ECRList = lazy(() => import('./pages/ecrs/ECRList').then((m) => ({ default: m.ECRList })));
const ECRDetail = lazy(() => import('./pages/ecrs/ECRDetail').then((m) => ({ default: m.ECRDetail })));
const ECNList = lazy(() => import('./pages/ecns/ECNList').then((m) => ({ default: m.ECNList })));
const ECNDetail = lazy(() => import('./pages/ecns/ECNDetail').then((m) => ({ default: m.ECNDetail })));
const ApprovalsWorkspace = lazy(() => import('./pages/approvals/ApprovalsWorkspace').then((m) => ({ default: m.ApprovalsWorkspace })));
const UserList = lazy(() => import('./pages/users/UserList').then((m) => ({ default: m.UserList })));
const SuppliersList = lazy(() => import('./pages/suppliers/SuppliersList').then((m) => ({ default: m.SuppliersList })));
const InventoryList = lazy(() => import('./pages/inventory/InventoryList').then((m) => ({ default: m.InventoryList })));
const PurchaseOrdersList = lazy(() => import('./pages/purchasing/PurchaseOrdersList').then((m) => ({ default: m.PurchaseOrdersList })));
const WorkOrdersList = lazy(() => import('./pages/manufacturing/WorkOrdersList').then((m) => ({ default: m.WorkOrdersList })));
const QualityWorkspace = lazy(() => import('./pages/quality/QualityWorkspace').then((m) => ({ default: m.QualityWorkspace })));
const NotificationCenter = lazy(() => import('./pages/notifications/NotificationCenter').then((m) => ({ default: m.NotificationCenter })));
const ReportsHub = lazy(() => import('./pages/reports/ReportsHub').then((m) => ({ default: m.ReportsHub })));
const AdminWorkspace = lazy(() => import('./pages/admin/AdminWorkspace').then((m) => ({ default: m.AdminWorkspace })));

function RouteFallback() {
  return (
    <div className="flex h-64 w-full items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        <p className="text-sm font-medium text-slate-500">Loading view...</p>
      </div>
    </div>
  );
}

export function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* Public Auth Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected Application Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="categories" element={<ProtectedRoute requiredPermission="product:read"><CategoriesList /></ProtectedRoute>} />
          <Route path="products" element={<ProtectedRoute requiredPermission="product:read"><ProductsList /></ProtectedRoute>} />
          <Route path="products/:id" element={<ProtectedRoute requiredPermission="product:read"><ProductDetail /></ProtectedRoute>} />
          <Route path="boms" element={<ProtectedRoute requiredPermission="bom:read"><BOMList /></ProtectedRoute>} />
          <Route path="boms/:id" element={<ProtectedRoute requiredPermission="bom:read"><BOMDetail /></ProtectedRoute>} />
          <Route path="ecos" element={<ProtectedRoute requiredPermission="eco:read"><ECOList /></ProtectedRoute>} />
          <Route path="ecos/:id" element={<ProtectedRoute requiredPermission="eco:read"><ECODetail /></ProtectedRoute>} />
          <Route path="ecrs" element={<ProtectedRoute requiredPermission="ecr:read"><ECRList /></ProtectedRoute>} />
          <Route path="ecrs/:id" element={<ProtectedRoute requiredPermission="ecr:read"><ECRDetail /></ProtectedRoute>} />
          <Route path="ecns" element={<ProtectedRoute requiredPermission="ecn:read"><ECNList /></ProtectedRoute>} />
          <Route path="ecns/:id" element={<ProtectedRoute requiredPermission="ecn:read"><ECNDetail /></ProtectedRoute>} />
          <Route path="suppliers" element={<ProtectedRoute requiredPermission="supplier:read"><SuppliersList /></ProtectedRoute>} />
          <Route path="purchasing" element={<ProtectedRoute requiredPermission="purchasing:read"><PurchaseOrdersList /></ProtectedRoute>} />
          <Route path="inventory" element={<ProtectedRoute requiredPermission="inventory:read"><InventoryList /></ProtectedRoute>} />
          <Route path="manufacturing" element={<ProtectedRoute requiredPermission="manufacturing:read"><WorkOrdersList /></ProtectedRoute>} />
          <Route path="quality" element={<ProtectedRoute requiredPermission="quality:read"><QualityWorkspace /></ProtectedRoute>} />
          <Route path="notifications" element={<NotificationCenter />} />
          <Route path="reports" element={<ProtectedRoute requiredPermission="reports:read"><ReportsHub /></ProtectedRoute>} />
          <Route
            path="approvals"
            element={
              <ProtectedRoute requiredPermission="approvals:read">
                <ApprovalsWorkspace />
              </ProtectedRoute>
            }
          />
          <Route
            path="users"
            element={
              <ProtectedRoute requiredPermission="user:read">
                <UserList />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin"
            element={
              <ProtectedRoute requiredPermission="admin:all">
                <AdminWorkspace />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}
export default App;

