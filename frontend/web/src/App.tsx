import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { Login } from './pages/auth/Login';
import { Register } from './pages/auth/Register';
import { Dashboard } from './pages/dashboard/Dashboard';
import { ProductsList } from './pages/products/ProductsList';
import { ProductDetail } from './pages/products/ProductDetail';
import { CategoriesList } from './pages/categories/CategoriesList';
import { BOMList } from './pages/boms/BOMList';
import { BOMDetail } from './pages/boms/BOMDetail';
import { ECOList } from './pages/ecos/ECOList';
import { ECODetail } from './pages/ecos/ECODetail';
import { ECRList } from './pages/ecrs/ECRList';
import { ECRDetail } from './pages/ecrs/ECRDetail';
import { ECNList } from './pages/ecns/ECNList';
import { ECNDetail } from './pages/ecns/ECNDetail';
import { ApprovalsWorkspace } from './pages/approvals/ApprovalsWorkspace';
import { UserList } from './pages/users/UserList';

export function App() {
  return (
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
        <Route path="products" element={<ProductsList />} />
        <Route path="products/:id" element={<ProductDetail />} />
        <Route path="categories" element={<CategoriesList />} />
        <Route path="boms" element={<BOMList />} />
        <Route path="boms/:id" element={<BOMDetail />} />
        <Route path="ecos" element={<ECOList />} />
        <Route path="ecos/:id" element={<ECODetail />} />
        <Route path="ecrs" element={<ECRList />} />
        <Route path="ecrs/:id" element={<ECRDetail />} />
        <Route path="ecns" element={<ECNList />} />
        <Route path="ecns/:id" element={<ECNDetail />} />
        <Route
          path="approvals"
          element={
            <ProtectedRoute requiredPermission="eco:approve">
              <ApprovalsWorkspace />
            </ProtectedRoute>
          }
        />
        <Route
          path="users"
          element={
            <ProtectedRoute requiredRole="ADMINISTRATOR">
              <UserList />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
export default App;

